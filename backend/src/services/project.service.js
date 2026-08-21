const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const MEMBER_SELECT = {
  userId: true,
  assignedAt: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
};

// Flattens a ProjectMembership row into the shape the frontend actually
// wants to render (member fields alongside assignedAt, not nested under `user`).
const toMemberView = (membership) => ({
  id: membership.user.id,
  firstName: membership.user.firstName,
  lastName: membership.user.lastName,
  email: membership.user.email,
  assignedAt: membership.assignedAt,
});

const listAllProjects = async () => {
  const projects = await prisma.project.findMany({
    orderBy: { name: "asc" },
    include: { memberships: { select: MEMBER_SELECT, orderBy: { user: { firstName: "asc" } } } },
  });
  return projects.map((project) => ({
    ...project,
    assignedEmployees: project.memberships.map(toMemberView),
    memberships: undefined,
  }));
};

const assertNameAvailable = async (name, excludeId) => {
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing && existing.id !== excludeId) {
    throw ApiError.badRequest("A project with this name already exists.");
  }
};

const getProjectWithMembers = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { memberships: { select: MEMBER_SELECT, orderBy: { user: { firstName: "asc" } } } },
  });
  return { ...project, assignedEmployees: project.memberships.map(toMemberView), memberships: undefined };
};

// Sets this project's member list to exactly `employeeIds` - anyone
// currently on it but left off the new list is removed, everyone new in the
// list is added (with a fresh assignedAt), and anyone already on it who's
// still in the list is left untouched (keeps their original assignedAt).
// Unlike the old single-project model, this never touches an employee's
// membership on any OTHER project - one employee can be on several projects
// at once.
const setProjectMembers = async (projectId, employeeIds) => {
  const existing = await prisma.projectMembership.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const wantedIds = new Set(employeeIds);

  const toRemove = [...existingIds].filter((id) => !wantedIds.has(id));
  const toAdd = [...wantedIds].filter((id) => !existingIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [prisma.projectMembership.deleteMany({ where: { projectId, userId: { in: toRemove } } })]
      : []),
    ...(toAdd.length > 0
      ? [
          prisma.projectMembership.createMany({
            data: toAdd.map((userId) => ({ projectId, userId })),
          }),
        ]
      : []),
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
  return prisma.project.update({ where: { id }, data: { isActive } });
};

// Every project a given employee is currently a member of - used to build
// their own timesheet's project switcher.
const listProjectsForEmployee = (userId) =>
  prisma.project.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { name: "asc" },
  });

module.exports = {
  listAllProjects,
  createProject,
  renameProject,
  setProjectActive,
  setProjectMembers,
  listProjectsForEmployee,
};
