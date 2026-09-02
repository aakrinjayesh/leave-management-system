const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");
const { sendTimesheetSubmittedEmail } = require("../utils/email.util");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { uploadToS3, isS3Url } = require("../utils/s3.util");
const { TIMESHEET_ATTACHMENT_DIR } = require("../config/timesheetAttachmentUpload");

// Every project this employee is currently assigned to - drives the project
// switcher on their timesheet page, since each project has its own
// independent weekly grid/submission.
const listMyProjects = asyncHandler(async (req, res) => {
  const projects = await projectService.listProjectsForEmployee(req.user.id);

  new ApiResponse(200, "OK", { projects }).send(res);
});

// Resolves which project this call is for: the requested id if given and the
// employee is actually assigned to it, otherwise their first assigned
// project (so a fresh page load always lands somewhere sensible), or null if
// they aren't assigned to any project at all yet.
const resolveProjectForRequest = async (userId, requestedProjectId) => {
  const projects = await projectService.listProjectsForEmployee(userId);
  if (projects.length === 0) return { project: null, projects };

  const requested = requestedProjectId ? projects.find((p) => p.id === Number(requestedProjectId)) : null;
  return { project: requested || projects[0], projects };
};

const getMyEntries = asyncHandler(async (req, res) => {
  const anchor = req.query.weekStart ? new Date(req.query.weekStart) : new Date();

  const { project, projects } = await resolveProjectForRequest(req.user.id, req.query.projectId);

  if (!project) {
    const weekStartDate = timesheetService.getWeekStart(anchor);
    return new ApiResponse(200, "OK", {
      weekStartDate,
      weekEndDate: timesheetService.getWeekEnd(weekStartDate),
      entries: [],
      submission: null,
      project: null,
      projects,
      totalHours: 0,
    }).send(res);
  }

  // The submission period this grid/upload covers - a Monday-Sunday week or
  // a full calendar month, depending on this project's own setting.
  const weekStartDate = timesheetService.getPeriodStart(anchor, project.submissionFrequency);
  const weekEndDate = timesheetService.getPeriodEnd(weekStartDate, project.submissionFrequency);

  const [entries, submission] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { userId: req.user.id, projectId: project.id, date: { gte: weekStartDate, lte: weekEndDate } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.timesheetSubmission.findUnique({
      where: { userId_weekStartDate_projectId: { userId: req.user.id, weekStartDate, projectId: project.id } },
      // Narrowed select (no clientName) - this is the employee's own view.
      include: { project: { select: projectService.EMPLOYEE_PROJECT_SELECT } },
    }),
  ]);

  new ApiResponse(200, "OK", {
    weekStartDate,
    weekEndDate,
    entries,
    submission,
    project,
    projects,
    totalHours: timesheetService.sumHours(entries),
  }).send(res);
});

// One entry per user per date per project - saving a day creates it if it
// doesn't exist yet, or updates it in place if it does (the grid always
// edits in place, never creates a second entry for the same day within the
// same project's grid).
const saveEntry = asyncHandler(async (req, res) => {
  const { date, hoursWorked, description, projectId } = req.body;
  const entryDate = timesheetService.startOfUtcDay(date);

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: req.user.id, projectId } },
    include: { project: { select: { submissionFrequency: true } } },
  });
  if (!membership) {
    throw ApiError.badRequest("You aren't assigned to this project.");
  }

  const weekStartDate = timesheetService.getPeriodStart(entryDate, membership.project.submissionFrequency);

  // A rejected submission no longer blocks editing - its entries were
  // already unlocked when it was rejected, and the period stays open until a
  // fresh submission is created.
  const existingSubmission = await prisma.timesheetSubmission.findUnique({
    where: { userId_weekStartDate_projectId: { userId: req.user.id, weekStartDate, projectId } },
  });
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    throw ApiError.badRequest("This period has already been submitted and can no longer be edited.");
  }

  const entry = await prisma.timesheetEntry.upsert({
    where: { userId_date_projectId: { userId: req.user.id, date: entryDate, projectId } },
    update: { hoursWorked, description: description || null },
    create: {
      userId: req.user.id,
      date: entryDate,
      hoursWorked,
      description: description || null,
      weekStartDate,
      projectId,
    },
  });

  new ApiResponse(200, "Entry saved.", { entry }).send(res);
});

const getOwnUnlockedEntryOr404 = async (id, userId) => {
  const entry = await prisma.timesheetEntry.findFirst({ where: { id, userId } });
  if (!entry) {
    throw ApiError.notFound("Timesheet entry not found.");
  }
  if (entry.timesheetSubmissionId) {
    throw ApiError.badRequest("This entry is part of a submitted week and can no longer be changed.");
  }
  return entry;
};

const deleteEntry = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  await getOwnUnlockedEntryOr404(id, req.user.id);

  await prisma.timesheetEntry.delete({ where: { id } });

  new ApiResponse(200, "Entry deleted.").send(res);
});

// Uploaded ahead of submission, so the employee can review it before the
// actual submission exists - the returned names get passed back in as
// attachmentStoredName/attachmentOriginalName when they call submitWeek.
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }

  const { url } = await uploadToS3(req.file, "timesheet-attachments");

  new ApiResponse(201, "File uploaded.", {
    attachmentStoredName: url,
    attachmentOriginalName: req.file.originalname,
  }).send(res);
});

const submitWeek = asyncHandler(async (req, res) => {
  const { weekStartDate: rawWeekStart, attachmentOriginalName, attachmentStoredName, projectId } = req.body;

  if (!req.user.managerId) {
    throw ApiError.badRequest("Please set your manager in your profile before submitting a timesheet.");
  }

  // Every submission is scoped to one specific project the employee is
  // actually assigned to - an employee on 2 projects submits a separate
  // timesheet per project, per period. Client vs internal is read straight
  // off that project's own admin-set type, so it can't drift from what the
  // project itself says.
  if (!projectId) {
    throw ApiError.badRequest("Please choose which project this timesheet is for.");
  }
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: req.user.id, projectId } },
  });
  if (!membership) {
    throw ApiError.badRequest("You aren't assigned to this project.");
  }
  const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true } });
  if (!project) {
    throw ApiError.badRequest("This project is no longer active. Please contact your admin.");
  }
  const projectAssigned = project.projectType;

  // The submission period this covers - a Monday-Sunday week or a full
  // calendar month, depending on this project's own setting.
  const weekStartDate = timesheetService.getPeriodStart(rawWeekStart, project.submissionFrequency);
  const weekEndDate = timesheetService.getPeriodEnd(weekStartDate, project.submissionFrequency);

  const recipient = await prisma.user.findFirst({ where: { id: req.user.managerId, status: "ACTIVE" } });
  if (!recipient) {
    throw ApiError.badRequest("Your assigned manager's account isn't active. Please update your manager in your profile.");
  }

  const existingSubmission = await prisma.timesheetSubmission.findUnique({
    where: { userId_weekStartDate_projectId: { userId: req.user.id, weekStartDate, projectId } },
  });
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    throw ApiError.badRequest("This period has already been submitted for this project.");
  }

  const draftEntries = await prisma.timesheetEntry.findMany({
    where: { userId: req.user.id, projectId, weekStartDate, timesheetSubmissionId: null },
  });
  if (draftEntries.length === 0) {
    throw ApiError.badRequest("There are no entries to submit for this period.");
  }

  const totalHours = timesheetService.sumHours(draftEntries);

  // A week+project can only ever have one submission row (userId +
  // weekStartDate + projectId is unique), so resubmitting after a rejection
  // reopens that same row as a fresh Pending submission instead of creating
  // a new one.
  const submission = existingSubmission
    ? await prisma.timesheetSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          totalHours,
          routedToId: recipient.id,
          status: "PENDING",
          managerRemarks: null,
          approvedById: null,
          approvedAt: null,
          rejectedAt: null,
          submittedAt: new Date(),
          attachmentOriginalName,
          attachmentStoredName,
          projectAssigned,
        },
      })
    : await prisma.timesheetSubmission.create({
        data: {
          userId: req.user.id,
          weekStartDate,
          weekEndDate,
          totalHours,
          routedToId: recipient.id,
          status: "PENDING",
          attachmentOriginalName,
          attachmentStoredName,
          projectAssigned,
          projectId,
        },
      });

  await prisma.timesheetEntry.updateMany({
    where: { id: { in: draftEntries.map((e) => e.id) } },
    data: { timesheetSubmissionId: submission.id },
  });

  new ApiResponse(201, "Timesheet submitted.", { submission }).send(res);

  // Notify the manager and every active admin - sent after the response so
  // the employee doesn't wait on the email round-trips; failures here
  // shouldn't fail the submission itself.
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
    const recipients = [recipient, ...admins.filter((a) => a.id !== recipient.id)];
    const employeeName = `${req.user.firstName} ${req.user.lastName}`;

    for (const person of recipients) {
      try {
        await sendTimesheetSubmittedEmail({
          to: person.email,
          recipientFirstName: person.firstName,
          employeeName,
          weekStartDate,
          weekEndDate,
          totalHours,
        });
      } catch (err) {
        console.error("Failed to send timesheet submitted email:", err);
      }

      try {
        await notificationService.notify({
          userId: person.id,
          type: notificationService.NOTIFICATION_TYPES.TIMESHEET_SUBMITTED,
          title: "Timesheet submitted",
          message: `${employeeName} submitted their timesheet for ${formatDateShort(weekStartDate)} - ${formatDateShort(
            weekEndDate
          )}.`,
        });
      } catch (err) {
        console.error("Failed to create timesheet submitted notification:", err);
      }
    }
  } catch (err) {
    console.error("Failed to notify about timesheet submission:", err);
  }
});

const listMySubmissions = asyncHandler(async (req, res) => {
  const { status, projectId } = req.query;

  const submissions = await prisma.timesheetSubmission.findMany({
    where: {
      userId: req.user.id,
      ...(status ? { status } : {}),
      ...(projectId ? { projectId: Number(projectId) } : {}),
    },
    include: {
      routedTo: { select: { firstName: true, lastName: true } },
      entries: { orderBy: { date: "asc" } },
      project: { select: { name: true } },
    },
    orderBy: { weekStartDate: "desc" },
  });

  new ApiResponse(200, "OK", { submissions }).send(res);
});

// The Excel sheet the employee attached to one of their own weekly
// submissions - scoped to their own submissions only, same pattern as the
// manager's equivalent endpoint.
const getSubmissionAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const submission = await prisma.timesheetSubmission.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!submission) {
    throw ApiError.notFound("Timesheet submission not found.");
  }
  if (!submission.attachmentStoredName) {
    throw ApiError.notFound("No attachment found for this submission.");
  }

  if (isS3Url(submission.attachmentStoredName)) {
    return res.redirect(submission.attachmentStoredName);
  }

  // Legacy attachment uploaded before the S3 migration - still on local disk.
  const filePath = path.join(TIMESHEET_ATTACHMENT_DIR, path.basename(submission.attachmentStoredName));
  res.download(filePath, submission.attachmentOriginalName || submission.attachmentStoredName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

module.exports = {
  listMyProjects,
  getMyEntries,
  saveEntry,
  deleteEntry,
  uploadAttachment,
  submitWeek,
  listMySubmissions,
  getSubmissionAttachment,
};
