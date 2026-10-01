const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");
const payrollReportService = require("../services/payrollReport.service");
const notificationService = require("../services/notification.service");
const ApiError = require("../utils/ApiError");
const { sendProjectChangedEmail } = require("../utils/email.util");
const { uploadToS3 } = require("../utils/s3.util");

// Notifies every active account - the project list feeds the timesheet
// dropdown everyone uses, so a project add/rename/status change is
// company-wide, not just visible to the admin who made it.
const notifyAllOfProjectChange = async (message) => {
  // In-app: everyone (the project list feeds the timesheet dropdown all use).
  // Email: only admins + managers, so routine project edits don't mail the
  // whole company.
  try {
    const everyone = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    await notificationService.notifyMany(
      everyone.map((u) => u.id),
      { type: notificationService.NOTIFICATION_TYPES.PROJECT_UPDATED, title: "Project list updated", message }
    );
  } catch (err) {
    console.error("Failed to create project updated notification:", err);
  }

  try {
    const recipients = await notificationService.getAdminAndManagerRecipients();
    for (const recipient of recipients) {
      try {
        await sendProjectChangedEmail({
          to: recipient.email,
          recipientFirstName: recipient.firstName,
          message,
        });
      } catch (err) {
        console.error("Failed to send project changed email:", err);
      }
    }
  } catch (err) {
    console.error("Failed to load recipients for project changed email:", err);
  }
};

const getProjectAssignmentReport = asyncHandler(async (req, res) => {
  const report = await timesheetService.getProjectAssignmentReport();

  new ApiResponse(200, "OK", report).send(res);
});

const getProjectHistory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const history = await timesheetService.getProjectHistoryForUser(id);

  new ApiResponse(200, "OK", { history }).send(res);
});

// Every timesheet submission for the Mon-Sun week containing `date` - lets
// the Report page show, per employee, whether they submitted a timesheet
// that week and offer its attachment for download. Also returns the
// working-days/hours workload breakdown for that same week (see
// timesheetService.getWeeklyWorkloadReport).
const getWeekTimesheetSubmissions = asyncHandler(async (req, res) => {
  const anchor = req.query.date ? new Date(req.query.date) : new Date();
  const weekStartDate = timesheetService.getWeekStart(anchor);
  const weekEndDate = timesheetService.getWeekEnd(weekStartDate);

  const [submissions, workload] = await Promise.all([
    prisma.timesheetSubmission.findMany({
      where: { weekStartDate },
      select: {
        id: true,
        userId: true,
        projectId: true,
        status: true,
        attachmentOriginalName: true,
        attachmentStoredName: true,
      },
    }),
    timesheetService.getWeeklyWorkloadReport(weekStartDate, weekEndDate),
  ]);

  new ApiResponse(200, "OK", { weekStartDate, weekEndDate, submissions, workload }).send(res);
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await projectService.listAllProjects();

  new ApiResponse(200, "OK", { projects }).send(res);
});

const toProjectDetails = ({
  projectType,
  clientName,
  clientFullName,
  clientAddress,
  clientState,
  gstNumber,
  gstDocumentUrl,
  panNumber,
  panDocumentUrl,
  msmeDocumentUrl,
  paymentTerms,
  sowDocumentUrl,
  rateCard,
  agreementDocumentUrl,
  timezone,
  workStartTime,
  workEndTime,
  startDate,
  endDate,
  submissionFrequency,
}) => ({
  projectType,
  clientName,
  clientFullName,
  clientAddress,
  clientState,
  gstNumber,
  gstDocumentUrl,
  panNumber,
  panDocumentUrl,
  msmeDocumentUrl,
  paymentTerms,
  sowDocumentUrl,
  rateCard,
  agreementDocumentUrl,
  timezone,
  workStartTime,
  workEndTime,
  startDate,
  endDate,
  submissionFrequency,
});

// Client/company document types a project can carry, and the S3 subfolder
// each goes in - kept separate from clientName's own bucket so it's
// browsable. Generic (no project id needed yet) so this same endpoint works
// while filling in a brand-new project's form, before it's ever saved - see
// projectDetailsSchema for the *DocumentUrl fields this feeds.
const PROJECT_DOCUMENT_FOLDER_BY_TYPE = {
  gst: "project-documents/gst",
  pan: "project-documents/pan",
  msme: "project-documents/msme",
  sow: "project-documents/sow",
  agreement: "project-documents/agreement",
};

const uploadProjectDocument = asyncHandler(async (req, res) => {
  const folder = PROJECT_DOCUMENT_FOLDER_BY_TYPE[req.params.type];
  if (!folder) {
    throw ApiError.badRequest("Unknown document type.");
  }
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }

  const { url } = await uploadToS3(req.file, folder);

  new ApiResponse(201, "File uploaded.", { url, fileName: req.file.originalname }).send(res);
});

const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(
    req.body.name,
    req.user.id,
    toProjectDetails(req.body),
    req.body.members
  );

  new ApiResponse(201, "Project added.", { project }).send(res);

  await notifyAllOfProjectChange(`A new project "${project.name}" has been added.`);
});

const renameProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.renameProject(id, req.body.name, toProjectDetails(req.body), req.body.members);

  new ApiResponse(200, "Project updated.", { project }).send(res);

  await notifyAllOfProjectChange(`Project "${project.name}" has been updated.`);
});

const setProjectMembers = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.updateProjectMembers(id, req.body.members);

  new ApiResponse(200, "Project members updated.", { project }).send(res);

  await notifyAllOfProjectChange(`Project "${project.name}" team has been updated.`);
});

// Every employee who has logged time against this project before admin-set
// membership existed - shown as a hint in the Edit Project modal so admin
// can decide whether to formally add them (see timesheetService.getRecentProjectMembers).
const getProjectRecentMembers = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const members = await timesheetService.getRecentProjectMembers(id);

  new ApiResponse(200, "OK", { members }).send(res);
});

const deactivateProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.setProjectActive(id, false);

  new ApiResponse(200, "Project deactivated.", { project }).send(res);

  await notifyAllOfProjectChange(`Project "${project.name}" has been deactivated.`);
});

const reactivateProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.setProjectActive(id, true);

  new ApiResponse(200, "Project reactivated.", { project }).send(res);

  await notifyAllOfProjectChange(`Project "${project.name}" has been reactivated.`);
});

// Consolidated payroll register - ?scope=employees|contract,
// ?month=YYYY-MM, ?mode=monthly|cumulative
const getPayrollReport = asyncHandler(async (req, res) => {
  const scope = req.query.scope === "contract" ? "contract" : "employees";
  const mode = req.query.mode === "cumulative" ? "cumulative" : "monthly";

  const match = /^(\d{4})-(\d{2})$/.exec(String(req.query.month || ""));
  if (!match) {
    throw ApiError.badRequest("Please provide a valid month (YYYY-MM).");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw ApiError.badRequest("Please provide a valid month (YYYY-MM).");
  }

  const data =
    scope === "contract"
      ? await payrollReportService.getContractRegister(year, month, mode)
      : await payrollReportService.getEmployeeRegister(year, month, mode);

  new ApiResponse(200, "OK", { scope, mode, year, month, ...data }).send(res);
});

module.exports = {
  getPayrollReport,
  getProjectAssignmentReport,
  getProjectHistory,
  getProjectRecentMembers,
  getWeekTimesheetSubmissions,
  listProjects,
  createProject,
  renameProject,
  uploadProjectDocument,
  setProjectMembers,
  deactivateProject,
  reactivateProject,
};
