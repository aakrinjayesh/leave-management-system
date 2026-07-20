const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const { sendTimesheetDecisionEmail } = require("../utils/email.util");

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
  const entries = await timesheetService.getSubmittedEntriesInRange(employeeId, start, end);

  new ApiResponse(200, "OK", {
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email },
    view,
    rangeStart: start,
    rangeEnd: end,
    entries,
    totalHours: timesheetService.sumHours(entries),
  }).send(res);
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

  new ApiResponse(200, "Timesheet approved.", { submission: updated }).send(res);
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

  new ApiResponse(200, "Timesheet rejected.", { submission: updated }).send(res);
});

module.exports = {
  listTeamSubmissions,
  getEmployeeTimesheet,
  exportEmployeeTimesheet,
  approveSubmission,
  rejectSubmission,
};
