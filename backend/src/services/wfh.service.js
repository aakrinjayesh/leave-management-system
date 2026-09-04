const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const {
  getWeekendPolicies,
  getHolidaysInRange,
  isWeekendDate,
  eachDate,
  toDateKey,
} = require("./leaveCalendar.service");
const { formatDateShort } = require("../utils/formatDate.util");

// Approved leave and approved WFH must never cover the same day - you can't
// be both on leave and working from home. Checked when a WFH request is
// submitted AND again when it's approved (leave may have been approved in
// between).
const findOverlappingApprovedLeave = (userId, startDate, endDate) =>
  prisma.leaveRequest.findFirst({
    where: { userId, status: "APPROVED", startDate: { lte: endDate }, endDate: { gte: startDate } },
    include: { leavePolicy: { select: { leaveName: true } } },
  });

const leaveOverlapText = (leave) =>
  `approved ${leave.leavePolicy.leaveName} (${formatDateShort(leave.startDate)} - ${formatDateShort(
    leave.endDate
  )}) that overlaps these dates`;

// A WFH request whose whole range is weekends / company holidays has nothing
// to work from home on.
const assertHasWorkingDay = async (startDate, endDate) => {
  const [weekendPolicies, holidays] = await Promise.all([
    getWeekendPolicies(),
    getHolidaysInRange(startDate, endDate),
  ]);
  const holidaySet = new Set(holidays.map((h) => toDateKey(h.holidayDate)));
  for (const d of eachDate(startDate, endDate)) {
    if (!isWeekendDate(d, weekendPolicies) && !holidaySet.has(toDateKey(d))) return;
  }
  throw ApiError.badRequest("These dates are all weekends or company holidays - there's nothing to work from home on.");
};

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

  await assertHasWorkingDay(startDate, endDate);

  const overlappingLeave = await findOverlappingApprovedLeave(userId, startDate, endDate);
  if (overlappingLeave) {
    throw ApiError.badRequest(`You have ${leaveOverlapText(overlappingLeave)}.`);
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
  const request = await getPendingOr404(id);

  const overlappingLeave = await findOverlappingApprovedLeave(
    request.userId,
    request.startDate,
    request.endDate
  );
  if (overlappingLeave) {
    throw ApiError.badRequest(
      `Can't approve - ${request.user.firstName} has ${leaveOverlapText(overlappingLeave)}.`
    );
  }

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

// Admin revokes a WFH request that was already approved (e.g. the employee is
// now going on leave those days, or plans changed). Sets it to CANCELLED.
const revokeApprovedWfhRequest = async (id, adminId, remarks) => {
  const request = await prisma.wfhRequest.findUnique({
    where: { id },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
  if (!request) {
    throw ApiError.notFound("WFH request not found.");
  }
  if (request.status !== "APPROVED") {
    throw ApiError.badRequest("Only an approved WFH request can be revoked.");
  }

  return prisma.wfhRequest.update({
    where: { id },
    data: {
      status: "CANCELLED",
      decidedById: adminId,
      decidedAt: new Date(),
      adminRemarks: remarks || "Approval revoked by admin.",
    },
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
  revokeApprovedWfhRequest,
};
