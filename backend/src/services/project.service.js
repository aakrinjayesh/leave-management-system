const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const listActiveProjects = () => prisma.project.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

const listAllProjects = () => prisma.project.findMany({ orderBy: { name: "asc" } });

const assertNameAvailable = async (name, excludeId) => {
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing && existing.id !== excludeId) {
    throw ApiError.badRequest("A project with this name already exists.");
  }
};

const createProject = async (name, createdById) => {
  await assertNameAvailable(name);
  return prisma.project.create({ data: { name, createdById } });
};

const getProjectOr404 = async (id) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  return project;
};

const renameProject = async (id, name) => {
  await getProjectOr404(id);
  await assertNameAvailable(name, id);
  return prisma.project.update({ where: { id }, data: { name } });
};

const setProjectActive = async (id, isActive) => {
  await getProjectOr404(id);
  return prisma.project.update({ where: { id }, data: { isActive } });
};

// The employee's most recently chosen project - mirrors
// timesheetService.getLastProjectAssigned, used to pre-fill a fresh week's
// Project Name dropdown with whatever they picked last time.
const getLastProjectId = async (userId) => {
  const submission = await prisma.timesheetSubmission.findFirst({
    where: { userId, projectId: { not: null } },
    orderBy: { weekStartDate: "desc" },
    select: { projectId: true },
  });
  return submission?.projectId ?? null;
};

module.exports = {
  listActiveProjects,
  listAllProjects,
  createProject,
  renameProject,
  setProjectActive,
  getLastProjectId,
};
