const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");
const notificationService = require("../services/notification.service");

// Notifies every active account - the project list feeds the timesheet
// dropdown everyone uses, so a project add/rename/status change is
// company-wide, not just visible to the admin who made it.
const notifyAllOfProjectChange = async (message) => {
  try {
    const everyone = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    await notificationService.notifyMany(
      everyone.map((u) => u.id),
      { type: notificationService.NOTIFICATION_TYPES.PROJECT_UPDATED, title: "Project list updated", message }
    );
  } catch (err) {
    console.error("Failed to create project updated notification:", err);
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

const toProjectDetails = ({ projectType, timezone, workStartTime, workEndTime, startDate, endDate, submissionFrequency }) => ({
  projectType,
  timezone,
  workStartTime,
  workEndTime,
  startDate,
  endDate,
  submissionFrequency,
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

module.exports = {
  getProjectAssignmentReport,
  getProjectHistory,
  getProjectRecentMembers,
  getWeekTimesheetSubmissions,
  listProjects,
  createProject,
  renameProject,
  setProjectMembers,
  deactivateProject,
  reactivateProject,
};
