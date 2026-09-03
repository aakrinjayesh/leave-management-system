const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const timesheetService = require("./timesheet.service");
const projectService = require("./project.service");
const notificationService = require("./notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

// "Log a timesheet on the employee's behalf" flow, shared by the manager
// (direct reports only) and the admin (any employee) paths. Mirrors the
// employee's own submitWeek, but the entries come from the manager/admin, the
// submission is auto-approved, and it's tagged createdByManager /
// createdByAdmin so the UI can show who logged it. The caller does the
// authorization check (direct report vs admin) - this doesn't.

// Resolves the project + submission period for the log modal: which project
// (must be one the employee is assigned to), the Monday-Sunday week or full
// month it covers, the entries already there, and whether it's locked.
const getLogPeriod = async ({ employee, projectId, anchorDate }) => {
  const projects = await projectService.listProjectsForEmployee(employee.id);
  if (projects.length === 0) {
    return { projects: [], project: null, weekStartDate: null, weekEndDate: null, entries: [], alreadySubmitted: false };
  }

  const requested = projectId ? projects.find((p) => p.id === Number(projectId)) : null;
  const project = requested || projects[0];
  const freq = project.submissionFrequency;

  const submissionFor = (weekStart) =>
    prisma.timesheetSubmission.findUnique({
      where: { userId_weekStartDate_projectId: { userId: employee.id, weekStartDate: weekStart, projectId: project.id } },
    });
  const isLocked = (submission) => Boolean(submission && submission.status !== "REJECTED");

  // Where to start: the requested period if the caller gave one, otherwise
  // today's - but if that's already submitted (and the caller didn't ask for
  // a specific one), walk back to the most recent still-open period so the
  // modal lands somewhere useful instead of always saying "already submitted".
  let weekStartDate = timesheetService.getPeriodStart(
    anchorDate ? new Date(anchorDate) : new Date(),
    freq
  );
  let existingSubmission = await submissionFor(weekStartDate);

  if (!anchorDate) {
    let hops = 0;
    while (isLocked(existingSubmission) && hops < 12) {
      const prev = new Date(weekStartDate);
      if (freq === "MONTHLY") prev.setUTCMonth(prev.getUTCMonth() - 1);
      else prev.setUTCDate(prev.getUTCDate() - 7);
      weekStartDate = timesheetService.getPeriodStart(prev, freq);
      // eslint-disable-next-line no-await-in-loop
      existingSubmission = await submissionFor(weekStartDate);
      hops += 1;
    }
  }

  const weekEndDate = timesheetService.getPeriodEnd(weekStartDate, freq);

  const entries = await prisma.timesheetEntry.findMany({
    where: { userId: employee.id, projectId: project.id, date: { gte: weekStartDate, lte: weekEndDate } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  return {
    projects,
    project,
    weekStartDate,
    weekEndDate,
    entries,
    alreadySubmitted: isLocked(existingSubmission),
  };
};

const logTimesheetForEmployee = async ({
  employee,
  actor,
  projectId,
  weekStartDate: rawWeekStart,
  days,
  attachmentOriginalName,
  attachmentStoredName,
  loggedByAdmin = false,
}) => {
  if (!projectId) {
    throw ApiError.badRequest("Please choose which project this timesheet is for.");
  }

  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: employee.id, projectId } },
  });
  if (!membership) {
    throw ApiError.badRequest(`${employee.firstName} isn't assigned to that project.`);
  }

  const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true } });
  if (!project) {
    throw ApiError.badRequest("This project is no longer active.");
  }

  const weekStartDate = timesheetService.getPeriodStart(rawWeekStart, project.submissionFrequency);
  const weekEndDate = timesheetService.getPeriodEnd(weekStartDate, project.submissionFrequency);

  const existingSubmission = await prisma.timesheetSubmission.findUnique({
    where: { userId_weekStartDate_projectId: { userId: employee.id, weekStartDate, projectId } },
  });
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    throw ApiError.badRequest("This period has already been submitted for this project.");
  }

  // Normalise the day rows: keep only in-range days, positive hours win, a
  // zero clears any draft that day already had.
  const inRange = (d) => d >= weekStartDate && d <= weekEndDate;
  const cleaned = [];
  const toClear = [];
  for (const day of days) {
    const date = timesheetService.startOfUtcDay(new Date(day.date));
    if (!inRange(date)) continue;
    const hours = Number(day.hoursWorked) || 0;
    if (hours > 24) {
      throw ApiError.badRequest("Hours can't exceed 24 in a day.");
    }
    if (hours > 0) {
      cleaned.push({ date, hoursWorked: hours, description: (day.description || "").trim() || null });
    } else {
      toClear.push(date);
    }
  }
  if (cleaned.length === 0) {
    throw ApiError.badRequest("Please enter hours for at least one day.");
  }

  const totalHours = cleaned.reduce((sum, d) => sum + d.hoursWorked, 0);
  const projectAssigned = project.projectType;

  const submission = await prisma.$transaction(async (tx) => {
    for (const day of cleaned) {
      await tx.timesheetEntry.upsert({
        where: { userId_date_projectId: { userId: employee.id, date: day.date, projectId } },
        update: { hoursWorked: day.hoursWorked, description: day.description },
        create: {
          userId: employee.id,
          date: day.date,
          hoursWorked: day.hoursWorked,
          description: day.description,
          weekStartDate,
          projectId,
        },
      });
    }

    // Drop any unlinked draft entries the manager/admin left blank this time.
    if (toClear.length > 0) {
      await tx.timesheetEntry.deleteMany({
        where: {
          userId: employee.id,
          projectId,
          date: { in: toClear },
          timesheetSubmissionId: null,
        },
      });
    }

    const created = existingSubmission
      ? await tx.timesheetSubmission.update({
          where: { id: existingSubmission.id },
          data: {
            totalHours,
            routedToId: actor.id,
            approvedById: actor.id,
            status: "APPROVED",
            managerRemarks: null,
            approvedAt: new Date(),
            rejectedAt: null,
            submittedAt: new Date(),
            attachmentOriginalName,
            attachmentStoredName,
            projectAssigned,
            createdByManager: true,
            createdByAdmin: loggedByAdmin,
          },
        })
      : await tx.timesheetSubmission.create({
          data: {
            userId: employee.id,
            weekStartDate,
            weekEndDate,
            totalHours,
            routedToId: actor.id,
            approvedById: actor.id,
            status: "APPROVED",
            approvedAt: new Date(),
            attachmentOriginalName,
            attachmentStoredName,
            projectAssigned,
            projectId,
            createdByManager: true,
            createdByAdmin: loggedByAdmin,
          },
        });

    // Link every still-unlinked entry for this period+project to the new
    // submission (the ones just upserted, plus any pre-existing drafts).
    await tx.timesheetEntry.updateMany({
      where: {
        userId: employee.id,
        projectId,
        date: { gte: weekStartDate, lte: weekEndDate },
        timesheetSubmissionId: null,
      },
      data: { timesheetSubmissionId: created.id },
    });

    return created;
  });

  // Best-effort: let the employee know it was logged for them.
  try {
    await notificationService.notify({
      userId: employee.id,
      type: notificationService.NOTIFICATION_TYPES.TIMESHEET_DECIDED,
      title: "Timesheet logged for you",
      message: `${actor.firstName} ${actor.lastName} logged and approved your timesheet for ${formatDateShort(
        weekStartDate
      )} - ${formatDateShort(weekEndDate)}.`,
    });
  } catch (err) {
    console.error("Failed to notify about logged timesheet:", err);
  }

  return { submission };
};

module.exports = { getLogPeriod, logTimesheetForEmployee };
