const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");

const getProjectAssignmentReport = asyncHandler(async (req, res) => {
  const report = await timesheetService.getProjectAssignmentReport();

  new ApiResponse(200, "OK", report).send(res);
});

// Every timesheet submission for the Mon-Sun week containing `date` - lets
// the Report page show, per employee, whether they submitted a timesheet
// that week and offer its attachment for download.
const getWeekTimesheetSubmissions = asyncHandler(async (req, res) => {
  const anchor = req.query.date ? new Date(req.query.date) : new Date();
  const weekStartDate = timesheetService.getWeekStart(anchor);
  const weekEndDate = timesheetService.getWeekEnd(weekStartDate);

  const submissions = await prisma.timesheetSubmission.findMany({
    where: { weekStartDate },
    select: {
      id: true,
      userId: true,
      status: true,
      attachmentOriginalName: true,
      attachmentStoredName: true,
    },
  });

  new ApiResponse(200, "OK", { weekStartDate, weekEndDate, submissions }).send(res);
});

const listProjects = asyncHandler(async (req, res) => {
  const projects = await projectService.listAllProjects();

  new ApiResponse(200, "OK", { projects }).send(res);
});

const createProject = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.body.name, req.user.id);

  new ApiResponse(201, "Project added.", { project }).send(res);
});

const renameProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.renameProject(id, req.body.name);

  new ApiResponse(200, "Project renamed.", { project }).send(res);
});

const deactivateProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.setProjectActive(id, false);

  new ApiResponse(200, "Project deactivated.", { project }).send(res);
});

const reactivateProject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const project = await projectService.setProjectActive(id, true);

  new ApiResponse(200, "Project reactivated.", { project }).send(res);
});

module.exports = {
  getProjectAssignmentReport,
  getWeekTimesheetSubmissions,
  listProjects,
  createProject,
  renameProject,
  deactivateProject,
  reactivateProject,
};
