const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const MEMBER_SELECT = { id: true, firstName: true, lastName: true, email: true };

const listAllProjects = () =>
  prisma.project.findMany({
    orderBy: { name: "asc" },
    include: { assignedEmployees: { select: MEMBER_SELECT, orderBy: { firstName: "asc" } } },
  });

const assertNameAvailable = async (name, excludeId) => {
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing && existing.id !== excludeId) {
    throw ApiError.badRequest("A project with this name already exists.");
  }
};

const getProjectWithMembers = (id) =>
  prisma.project.findUnique({
    where: { id },
    include: { assignedEmployees: { select: MEMBER_SELECT, orderBy: { firstName: "asc" } } },
  });

// Sets this project's member list to exactly `employeeIds` - anyone
// currently assigned here but left off the new list is unassigned (back to
// no project), and everyone in the new list gets assignedProjectId pointed
// at this project. Matches "one project per employee" - assigning someone
// here silently moves them off whatever project they were on before.
const setProjectMembers = async (projectId, employeeIds) => {
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { assignedProjectId: projectId, id: { notIn: employeeIds } },
      data: { assignedProjectId: null },
    }),
    prisma.user.updateMany({
      where: { id: { in: employeeIds } },
      data: { assignedProjectId: projectId },
    }),
  ]);
};

const createProject = async (name, createdById, details, employeeIds = []) => {
  await assertNameAvailable(name);
  const project = await prisma.project.create({ data: { name, createdById, ...details } });
  if (employeeIds.length > 0) {
    await setProjectMembers(project.id, employeeIds);
  }
  return getProjectWithMembers(project.id);
};

const getProjectOr404 = async (id) => {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    throw ApiError.notFound("Project not found.");
  }
  return project;
};

// Covers both a plain rename and the full "Edit project" modal (type,
// timezone, working hours, members) - same endpoint, since they're all just
// fields on the same row and never need to change independently of each other.
const renameProject = async (id, name, details, employeeIds) => {
  await getProjectOr404(id);
  await assertNameAvailable(name, id);
  await prisma.project.update({ where: { id }, data: { name, ...details } });
  if (employeeIds !== undefined) {
    await setProjectMembers(id, employeeIds);
  }
  return getProjectWithMembers(id);
};

const setProjectActive = async (id, isActive) => {
  await getProjectOr404(id);
  const project = await prisma.project.update({ where: { id }, data: { isActive } });

  // Deactivating frees up everyone on it immediately, rather than leaving
  // them stuck "taken" by a dead project until admin manually unchecks them
  // from its own edit screen (see ProjectMembersField's remaining-employees filter).
  if (!isActive) {
    await prisma.user.updateMany({ where: { assignedProjectId: id }, data: { assignedProjectId: null } });
  }

  return project;
};

module.exports = {
  listAllProjects,
  createProject,
  renameProject,
  setProjectActive,
  setProjectMembers,
};
