const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const { sendTimesheetDecisionEmail } = require("../utils/email.util");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { TIMESHEET_ATTACHMENT_DIR } = require("../config/timesheetAttachmentUpload");

const listTeamSubmissions = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const submissions = await prisma.timesheetSubmission.findMany({
    where: { routedToId: req.user.id, ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: [{ status: "asc" }, { weekStartDate: "desc" }],
  });

  new ApiResponse(200, "OK", { submissions }).send(res);
});

// Scoped to the manager's own direct reports - matches getEmployeeDetail's
// authorization on the leave side.
const getEmployeeTimesheet = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const view = ["day", "week", "month"].includes(req.query.view) ? req.query.view : "week";
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== req.user.id) {
    throw ApiError.notFound("Employee not found.");
  }

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const [entries, submissions] = await Promise.all([
    timesheetService.getSubmittedEntriesInRange(employeeId, start, end),
    timesheetService.getSubmissionsOverlappingRange(employeeId, start, end),
  ]);

  new ApiResponse(200, "OK", {
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email },
    view,
    rangeStart: start,
    rangeEnd: end,
    entries,
    submissions,
    totalHours: timesheetService.sumHours(entries),
  }).send(res);
});

// The Excel sheet an employee attached to one of their weekly submissions -
// scoped to the manager's own direct reports, same rule as getEmployeeTimesheet.
const getEmployeeTimesheetAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const submission = await getRoutedSubmissionOr404(id, req.user.id);
  if (!submission.attachmentStoredName) {
    throw ApiError.notFound("No attachment found for this submission.");
  }

  const filePath = path.join(TIMESHEET_ATTACHMENT_DIR, path.basename(submission.attachmentStoredName));
  res.download(filePath, submission.attachmentOriginalName || submission.attachmentStoredName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

// Same data as getEmployeeTimesheet, as a downloadable CSV instead of JSON.
const exportEmployeeTimesheet = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const view = ["day", "week", "month"].includes(req.query.view) ? req.query.view : "week";
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== req.user.id) {
    throw ApiError.notFound("Employee not found.");
  }

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const entries = await timesheetService.getSubmittedEntriesInRange(employeeId, start, end);
  const { csv, filename } = timesheetService.buildEmployeeTimesheetCsv({
    employee,
    view,
    rangeStart: start,
    rangeEnd: end,
    entries,
    totalHours: timesheetService.sumHours(entries),
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

const getRoutedSubmissionOr404 = async (id, routedToId) => {
  const submission = await prisma.timesheetSubmission.findFirst({
    where: { id, routedToId },
    include: { user: true },
  });
  if (!submission) {
    throw ApiError.notFound("Timesheet submission not found.");
  }
  return submission;
};

const approveSubmission = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const submission = await getRoutedSubmissionOr404(id, req.user.id);
  if (submission.status !== "PENDING") {
    throw ApiError.badRequest("This timesheet has already been actioned.");
  }

  const updated = await prisma.timesheetSubmission.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: req.user.id,
      approvedAt: new Date(),
      managerRemarks: remarks || null,
    },
  });

  new ApiResponse(200, "Timesheet approved.", { submission: updated }).send(res);

  // Sent after the response so the manager doesn't wait on the email round-trip.
  try {
    await sendTimesheetDecisionEmail({
      to: submission.user.email,
      employeeFirstName: submission.user.firstName,
      weekStartDate: submission.weekStartDate,
      weekEndDate: submission.weekEndDate,
      totalHours: submission.totalHours,
      status: "APPROVED",
      managerName: `${req.user.firstName} ${req.user.lastName}`,
      remarks: remarks || null,
    });
  } catch (err) {
    console.error("Failed to send timesheet approved email:", err);
  }

  try {
    await notificationService.notify({
      userId: submission.user.id,
      type: notificationService.NOTIFICATION_TYPES.TIMESHEET_DECIDED,
      title: "Timesheet approved",
      message: `Your timesheet for the week of ${formatDateShort(submission.weekStartDate)} - ${formatDateShort(
        submission.weekEndDate
      )} was approved by ${req.user.firstName} ${req.user.lastName}.`,
    });
  } catch (err) {
    console.error("Failed to create timesheet approved notification:", err);
  }
});

const rejectSubmission = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const submission = await getRoutedSubmissionOr404(id, req.user.id);
  if (submission.status !== "PENDING") {
    throw ApiError.badRequest("This timesheet has already been actioned.");
  }

  // Rejecting doesn't touch the entries' hours/description at all - it just
  // lifts the lock so the employee can fix them and submit the week again.
  // The rejected submission record itself stays exactly as-is for history.
  const [updated] = await prisma.$transaction([
    prisma.timesheetSubmission.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: req.user.id,
        rejectedAt: new Date(),
        managerRemarks: remarks,
      },
    }),
    prisma.timesheetEntry.updateMany({
      where: { timesheetSubmissionId: id },
      data: { timesheetSubmissionId: null },
    }),
  ]);

  new ApiResponse(200, "Timesheet rejected.", { submission: updated }).send(res);

  // Sent after the response so the manager doesn't wait on the email round-trip.
  try {
    await sendTimesheetDecisionEmail({
      to: submission.user.email,
      employeeFirstName: submission.user.firstName,
      weekStartDate: submission.weekStartDate,
      weekEndDate: submission.weekEndDate,
      totalHours: submission.totalHours,
      status: "REJECTED",
      managerName: `${req.user.firstName} ${req.user.lastName}`,
      remarks,
    });
  } catch (err) {
    console.error("Failed to send timesheet rejected email:", err);
  }

  try {
    await notificationService.notify({
      userId: submission.user.id,
      type: notificationService.NOTIFICATION_TYPES.TIMESHEET_DECIDED,
      title: "Timesheet rejected",
      message: `Your timesheet for the week of ${formatDateShort(submission.weekStartDate)} - ${formatDateShort(
        submission.weekEndDate
      )} was rejected by ${req.user.firstName} ${req.user.lastName}.`,
    });
  } catch (err) {
    console.error("Failed to create timesheet rejected notification:", err);
  }
});

module.exports = {
  listTeamSubmissions,
  getEmployeeTimesheet,
  getEmployeeTimesheetAttachment,
  exportEmployeeTimesheet,
  approveSubmission,
  rejectSubmission,
};
