const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

// Nests the employee's CURRENT project memberships onto every WFH request
// row - not stored on the request itself (see the WfhRequest model comment
// for why), just read live at display time so admin/manager always see
// whichever project(s) this employee is on right now.
const USER_SUMMARY_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    employeeCode: true,
    managerId: true,
    projectMemberships: {
      select: { project: { select: { id: true, name: true } } },
      orderBy: { project: { name: "asc" } },
    },
  },
};

const DECIDED_BY_SELECT = { decidedBy: { select: { id: true, firstName: true, lastName: true } } };

// One PENDING request at a time per employee - same rule as Resignation, so
// they can't stack up several requests awaiting a decision. A REJECTED
// request doesn't block submitting a new one.
const submitWfhRequest = async (userId, { startDate, endDate, reason }) => {
  const hasAnyProject = await prisma.projectMembership.findFirst({ where: { userId } });
  if (!hasAnyProject) {
    throw ApiError.badRequest("You aren't assigned to any project yet - contact your admin.");
  }

  const existingPending = await prisma.wfhRequest.findFirst({ where: { userId, status: "PENDING" } });
  if (existingPending) {
    throw ApiError.badRequest("You already have a pending WFH request.");
  }

  // Also block a new request that overlaps dates already covered by an
  // approved one.
  const overlappingApproved = await prisma.wfhRequest.findFirst({
    where: { userId, status: "APPROVED", startDate: { lte: endDate }, endDate: { gte: startDate } },
  });
  if (overlappingApproved) {
    throw ApiError.badRequest("You already have an approved WFH request that overlaps these dates.");
  }

  return prisma.wfhRequest.create({
    data: { userId, startDate, endDate, reason },
    include: DECIDED_BY_SELECT,
  });
};

// Every WFH request this employee has ever submitted, most recent first -
// lets their own WFH page show history alongside the submit form.
const getMyWfhRequests = (userId) =>
  prisma.wfhRequest.findMany({
    where: { userId },
    include: DECIDED_BY_SELECT,
    orderBy: { createdAt: "desc" },
  });

const withdrawWfhRequest = async (userId, id) => {
  const request = await prisma.wfhRequest.findFirst({ where: { id, userId } });
  if (!request) {
    throw ApiError.notFound("WFH request not found.");
  }
  if (request.status !== "PENDING") {
    throw ApiError.badRequest("Only a pending WFH request can be withdrawn.");
  }

  return prisma.wfhRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: DECIDED_BY_SELECT,
  });
};

// Manager sees WFH requests from whoever currently reports to them - view
// only, matches the current org chart rather than who their manager was at
// submission time (same pattern as Resignation.listForManager).
const listForManager = (managerId) =>
  prisma.wfhRequest.findMany({
    where: { user: { managerId } },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

const listForAdmin = (status) =>
  prisma.wfhRequest.findMany({
    where: status ? { status } : undefined,
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

const getPendingOr404 = async (id) => {
  const request = await prisma.wfhRequest.findUnique({
    where: { id },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
  if (!request) {
    throw ApiError.notFound("WFH request not found.");
  }
  if (request.status !== "PENDING") {
    throw ApiError.badRequest("This WFH request has already been actioned.");
  }
  return request;
};

const approveWfhRequest = async (id, adminId) => {
  await getPendingOr404(id);

  return prisma.wfhRequest.update({
    where: { id },
    data: { status: "APPROVED", decidedById: adminId, decidedAt: new Date() },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
};

const rejectWfhRequest = async (id, adminId, remarks) => {
  await getPendingOr404(id);

  return prisma.wfhRequest.update({
    where: { id },
    data: { status: "REJECTED", decidedById: adminId, decidedAt: new Date(), adminRemarks: remarks },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
};

module.exports = {
  submitWfhRequest,
  getMyWfhRequests,
  withdrawWfhRequest,
  listForManager,
  listForAdmin,
  approveWfhRequest,
  rejectWfhRequest,
};
