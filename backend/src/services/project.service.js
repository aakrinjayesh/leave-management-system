const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const MEMBER_SELECT = {
  userId: true,
  assignedAt: true,
  endDate: true,
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
};

// Every Project scalar EXCEPT clientName - what an employee is allowed to see
// about a project on their own timesheet. clientName is admin-only.
const EMPLOYEE_PROJECT_SELECT = {
  id: true,
  name: true,
  isActive: true,
  projectType: true,
  timezone: true,
  workStartTime: true,
  workEndTime: true,
  startDate: true,
  endDate: true,
  submissionFrequency: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
};

// Flattens a ProjectMembership row into the shape the frontend actually
// wants to render (member fields alongside assignedAt/endDate, not nested
// under `user`).
const toMemberView = (membership) => ({
  id: membership.user.id,
  firstName: membership.user.firstName,
  lastName: membership.user.lastName,
  email: membership.user.email,
  assignedAt: membership.assignedAt,
  endDate: membership.endDate,
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

// Sets this project's member list to exactly `members` - anyone currently on
// it but left off the new list is removed; everyone in the list is
// upserted with the given startDate/endDate, so admin can both add someone
// new with a backdated start date AND correct an existing member's dates
// later, in the same save. Unlike the old single-project model, this never
// touches an employee's membership on any OTHER project - one employee can
// be on several projects at once.
const setProjectMembers = async (projectId, members) => {
  const existing = await prisma.projectMembership.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const wantedIds = new Set(members.map((m) => m.userId));

  const toRemove = [...existingIds].filter((id) => !wantedIds.has(id));

  await prisma.$transaction([
    ...(toRemove.length > 0
      ? [prisma.projectMembership.deleteMany({ where: { projectId, userId: { in: toRemove } } })]
      : []),
    ...members.map(({ userId, startDate, endDate }) =>
      prisma.projectMembership.upsert({
        where: { userId_projectId: { userId, projectId } },
        update: { assignedAt: startDate, endDate: endDate ?? null },
        create: { userId, projectId, assignedAt: startDate, endDate: endDate ?? null },
      })
    ),
  ]);
};

const createProject = async (name, createdById, details, members = []) => {
  await assertNameAvailable(name);
  const project = await prisma.project.create({ data: { name, createdById, ...details } });
  if (members.length > 0) {
    await setProjectMembers(project.id, members);
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
const renameProject = async (id, name, details, members) => {
  await getProjectOr404(id);
  await assertNameAvailable(name, id);
  await prisma.project.update({ where: { id }, data: { name, ...details } });
  if (members !== undefined) {
    await setProjectMembers(id, members);
  }
  return getProjectWithMembers(id);
};

const setProjectActive = async (id, isActive) => {
  await getProjectOr404(id);
  return prisma.project.update({ where: { id }, data: { isActive } });
};

// Members-only edit - same effect as passing `members` to renameProject, but
// without having to resend every project detail field. Used by the standalone
// "Manage members" modal. An explicit [] clears the whole member list.
const updateProjectMembers = async (id, members) => {
  await getProjectOr404(id);
  await setProjectMembers(id, members);
  return getProjectWithMembers(id);
};

// Every project a given employee is currently a member of - used to build
// their own timesheet's project switcher.
const listProjectsForEmployee = (userId) =>
  prisma.project.findMany({
    where: { memberships: { some: { userId } } },
    orderBy: { name: "asc" },
    select: EMPLOYEE_PROJECT_SELECT,
  });

module.exports = {
  EMPLOYEE_PROJECT_SELECT,
  listAllProjects,
  createProject,
  renameProject,
  setProjectActive,
  setProjectMembers,
  updateProjectMembers,
  listProjectsForEmployee,
};
