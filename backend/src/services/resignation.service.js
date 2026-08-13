const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { RESIGNATION_STATUS } = require("../utils/constants");

const ACTIVE_STATUSES = [RESIGNATION_STATUS.PENDING, RESIGNATION_STATUS.ACCEPTED];

const DECIDED_BY_SELECT = { decidedBy: { select: { id: true, firstName: true, lastName: true } } };

// One PENDING or ACCEPTED resignation at a time per employee - a REJECTED or
// WITHDRAWN one doesn't block submitting a new one. proposedLastWorkingDate
// is just the employee's own notice date, not yet official - lastWorkingDate
// (the confirmed date) only gets set once admin accepts (see
// acceptResignation below).
const submitResignation = async (userId, reason, proposedLastWorkingDate) => {
  const existingActive = await prisma.resignation.findFirst({
    where: { userId, status: { in: ACTIVE_STATUSES } },
  });
  if (existingActive) {
    throw ApiError.badRequest("You already have a resignation in progress.");
  }

  return prisma.resignation.create({
    data: { userId, reason, proposedLastWorkingDate },
    include: DECIDED_BY_SELECT,
  });
};

// The employee's most recent resignation, whatever its status - lets the
// Profile page decide what to show (submit button vs. status/countdown vs.
// "your last one was rejected, you can submit again").
const getMyResignation = (userId) =>
  prisma.resignation.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: DECIDED_BY_SELECT,
  });

const withdrawResignation = async (userId, resignationId) => {
  const resignation = await prisma.resignation.findFirst({ where: { id: resignationId, userId } });
  if (!resignation) {
    throw ApiError.notFound("Resignation not found.");
  }
  if (resignation.status !== RESIGNATION_STATUS.PENDING) {
    throw ApiError.badRequest("Only a pending resignation can be withdrawn.");
  }

  return prisma.resignation.update({
    where: { id: resignationId },
    data: { status: RESIGNATION_STATUS.WITHDRAWN },
    include: DECIDED_BY_SELECT,
  });
};

const USER_SUMMARY_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    employeeCode: true,
    designation: true,
    joiningDate: true,
    managerId: true,
  },
};

// Manager sees resignations from whoever currently reports to them - view
// only, matches the current org chart rather than who their manager was at
// submission time.
const listForManager = (managerId) =>
  prisma.resignation.findMany({
    where: { user: { managerId } },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

const listForAdmin = () =>
  prisma.resignation.findMany({
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

const getPendingOr404 = async (resignationId) => {
  const resignation = await prisma.resignation.findUnique({ where: { id: resignationId }, include: { user: true } });
  if (!resignation) {
    throw ApiError.notFound("Resignation not found.");
  }
  if (resignation.status !== RESIGNATION_STATUS.PENDING) {
    throw ApiError.badRequest("This resignation has already been actioned.");
  }
  return resignation;
};

// The employee's proposedLastWorkingDate is a notice date, not their literal
// final day - accepting adds a full noticePeriodDays (30 by default) on top
// of it to get the CONFIRMED lastWorkingDate. Nothing counts down until this
// runs; before that, only the proposed date is shown, with no active notice
// period.
const acceptResignation = async (resignationId, adminId) => {
  const resignation = await getPendingOr404(resignationId);

  const decidedAt = new Date();
  const lastWorkingDate = new Date(resignation.proposedLastWorkingDate);
  lastWorkingDate.setUTCDate(lastWorkingDate.getUTCDate() + resignation.noticePeriodDays);

  return prisma.resignation.update({
    where: { id: resignationId },
    data: { status: RESIGNATION_STATUS.ACCEPTED, decidedById: adminId, decidedAt, lastWorkingDate },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
};

const rejectResignation = async (resignationId, adminId) => {
  await getPendingOr404(resignationId);

  return prisma.resignation.update({
    where: { id: resignationId },
    data: { status: RESIGNATION_STATUS.REJECTED, decidedById: adminId, decidedAt: new Date() },
    include: { user: USER_SUMMARY_SELECT, ...DECIDED_BY_SELECT },
  });
};

module.exports = {
  submitResignation,
  getMyResignation,
  withdrawResignation,
  listForManager,
  listForAdmin,
  acceptResignation,
  rejectResignation,
};
