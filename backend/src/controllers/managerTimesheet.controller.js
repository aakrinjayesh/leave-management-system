const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");
const timesheetDecisionService = require("../services/timesheetDecision.service");
const timesheetLogService = require("../services/timesheetLog.service");
const { isS3Url, uploadToS3 } = require("../utils/s3.util");
const { TIMESHEET_ATTACHMENT_DIR } = require("../config/timesheetAttachmentUpload");

const listTeamSubmissions = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const submissions = await prisma.timesheetSubmission.findMany({
    where: { routedToId: req.user.id, ...(status ? { status } : {}) },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      project: { select: { id: true, name: true } },
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

  // An employee assigned to several projects has a separate timesheet per
  // project - default to whichever one was requested, or their first
  // project if none was specified.
  const projects = await projectService.listProjectsForEmployee(employeeId);
  const requestedProjectId = req.query.projectId ? Number(req.query.projectId) : null;
  const projectId =
    requestedProjectId && projects.some((p) => p.id === requestedProjectId) ? requestedProjectId : projects[0]?.id ?? null;

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const [entries, submissions] = await Promise.all([
    timesheetService.getSubmittedEntriesInRange(employeeId, start, end, projectId),
    timesheetService.getSubmissionsOverlappingRange(employeeId, start, end, projectId),
  ]);

  new ApiResponse(200, "OK", {
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email },
    projects,
    projectId,
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

// Same data as getEmployeeTimesheet, as a downloadable CSV instead of JSON.
const exportEmployeeTimesheet = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const view = ["day", "week", "month"].includes(req.query.view) ? req.query.view : "week";
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== req.user.id) {
    throw ApiError.notFound("Employee not found.");
  }

  const projectId = req.query.projectId ? Number(req.query.projectId) : null;
  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const entries = await timesheetService.getSubmittedEntriesInRange(employeeId, start, end, projectId);
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

const decideSubmission = (decision) =>
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { remarks } = req.body;

    const submission = await getRoutedSubmissionOr404(id, req.user.id);

    const updated = await timesheetDecisionService.applyDecision({
      submission,
      actor: req.user,
      decision,
      remarks,
    });

    new ApiResponse(
      200,
      decision === "APPROVED" ? "Timesheet approved." : "Timesheet rejected.",
      { submission: updated }
    ).send(res);

    await timesheetDecisionService.sendDecisionSideEffects({ submission, actor: req.user, decision, remarks });
  });

const approveSubmission = decideSubmission("APPROVED");
const rejectSubmission = decideSubmission("REJECTED");

// ---------- Log timesheet on a direct report's behalf ----------

const getDirectReportOr404 = async (employeeId, managerId) => {
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== managerId) {
    throw ApiError.notFound("Employee not found.");
  }
  return employee;
};

const getLogPeriod = asyncHandler(async (req, res) => {
  const employee = await getDirectReportOr404(Number(req.params.id), req.user.id);

  const data = await timesheetLogService.getLogPeriod({
    employee,
    projectId: req.query.projectId,
    anchorDate: req.query.date,
  });

  new ApiResponse(200, "OK", data).send(res);
});

const uploadLogAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }
  const { url } = await uploadToS3(req.file, "timesheet-attachments");
  new ApiResponse(201, "File uploaded.", {
    attachmentStoredName: url,
    attachmentOriginalName: req.file.originalname,
  }).send(res);
});

const logTimesheet = asyncHandler(async (req, res) => {
  const employee = await getDirectReportOr404(Number(req.params.id), req.user.id);

  const { submission } = await timesheetLogService.logTimesheetForEmployee({
    employee,
    actor: req.user,
    ...req.body,
  });

  new ApiResponse(201, "Timesheet logged and approved.", { submission }).send(res);
});

module.exports = {
  listTeamSubmissions,
  getEmployeeTimesheet,
  getEmployeeTimesheetAttachment,
  exportEmployeeTimesheet,
  approveSubmission,
  rejectSubmission,
  getLogPeriod,
  uploadLogAttachment,
  logTimesheet,
};
