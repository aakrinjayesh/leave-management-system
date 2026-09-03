const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const leaveCalendarService = require("./leaveCalendar.service");
const leaveBalanceService = require("./leaveBalance.service");
const companySettingsService = require("./companySettings.service");
const { sendLeaveDecisionEmail } = require("../utils/email.util");

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Shared "log leave on someone's behalf" flow used by both the manager
// (direct reports only) and the admin (any employee) paths. The caller is
// responsible for loading `employee` and for any authorization check - this
// only books the leave (auto-approved, balance applied, overage split into
// Unpaid Leave for accrual policies) and returns the created rows.
const logLeaveForEmployee = async ({
  employee,
  actor,
  leavePolicyId,
  startDate,
  endDate,
  isHalfDay,
  reason,
  loggedByAdmin = false,
}) => {
  const leavePolicy = await prisma.leavePolicy.findFirst({ where: { id: leavePolicyId, isActive: true } });
  if (!leavePolicy) {
    throw ApiError.notFound("This leave type is not available.");
  }

  if (isHalfDay && !leavePolicy.allowHalfDay) {
    throw ApiError.badRequest(`${leavePolicy.leaveName} does not support half-day requests.`);
  }

  const requestStart = startOfUtcDay(startDate);
  const requestEnd = startOfUtcDay(endDate);

  // Sandwich rule (weekend between two leave-covered working days in the
  // same request also gets charged) only applies to Casual Leave.
  const applySandwichRule = leavePolicy.leaveName === "Casual Leave";
  const { totalDays, workingDates } = await leaveCalendarService.computeWorkingDays({
    startDate: requestStart,
    endDate: requestEnd,
    isHalfDay,
    applySandwichRule,
  });

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: employee.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: requestEnd },
      endDate: { gte: requestStart },
    },
  });
  if (overlapping) {
    throw ApiError.badRequest(`${employee.firstName} already has a leave request that overlaps these dates.`);
  }

  const requestFiscalYear = await companySettingsService.getFiscalYearForDate(requestStart);
  const balance = await leaveBalanceService.getOrCreateBalance(employee.id, leavePolicy, requestFiscalYear);

  // Default: the whole thing under its own policy, unchanged. Only
  // recomputed below if it doesn't fit the remaining balance.
  let requestSpecs = [{ leavePolicyId: leavePolicy.id, startDate: requestStart, endDate: requestEnd, totalDays }];
  let unpaidPolicy = null;
  let unpaidBalance = null;

  if (!leavePolicy.isUnlimited && totalDays > balance.remainingLeaves) {
    // Non-accrual capped policies keep the old hard block - only Sick/
    // Casual/Earned (accrual policies) auto-split the overage into Unpaid
    // Leave instead of rejecting the request outright.
    if (leavePolicy.monthlyAccrualDays == null) {
      throw ApiError.badRequest(
        `${employee.firstName} only has ${balance.remainingLeaves} day(s) of ${leavePolicy.leaveName} remaining.`
      );
    }

    unpaidPolicy = await prisma.leavePolicy.findFirst({ where: { isUnpaid: true, isActive: true } });
    if (!unpaidPolicy) {
      throw ApiError.badRequest(
        `${employee.firstName} only has ${balance.remainingLeaves} day(s) of ${leavePolicy.leaveName} remaining, and no Unpaid Leave policy is set up to cover the rest.`
      );
    }
    unpaidBalance = await leaveBalanceService.getOrCreateBalance(employee.id, unpaidPolicy, requestFiscalYear);

    requestSpecs = leaveBalanceService.splitForOverage({
      leavePolicy,
      unpaidPolicyId: unpaidPolicy.id,
      remainingLeaves: balance.remainingLeaves,
      workingDates,
      requestStart,
      requestEnd,
      isHalfDay,
      totalDays,
    });
  }

  const leaveRequests = [];
  for (const spec of requestSpecs) {
    const specBalance = spec.leavePolicyId === leavePolicy.id ? balance : unpaidBalance;
    await leaveBalanceService.applyUsage(specBalance.id, spec.totalDays);

    const created = await prisma.leaveRequest.create({
      data: {
        userId: employee.id,
        leavePolicyId: spec.leavePolicyId,
        routedToId: actor.id,
        approvedById: actor.id,
        startDate: spec.startDate,
        endDate: spec.endDate,
        totalDays: spec.totalDays,
        weekendsCountAsLeave: applySandwichRule,
        reason,
        status: "APPROVED",
        approvedAt: new Date(),
        createdByManager: true,
        createdByAdmin: loggedByAdmin,
      },
      include: { leavePolicy: true },
    });
    leaveRequests.push(created);
  }

  return { leaveRequests, wasSplit: leaveRequests.length > 1, leavePolicy };
};

// Fire-and-forget notification emails, sent after the HTTP response so the
// caller doesn't wait on the round-trip. Never throws.
const sendLoggedLeaveEmails = async ({ leaveRequests, employee, actor }) => {
  for (const leaveRequest of leaveRequests) {
    try {
      await sendLeaveDecisionEmail({
        to: employee.email,
        employeeFirstName: employee.firstName,
        leaveName: leaveRequest.leavePolicy.leaveName,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        totalDays: leaveRequest.totalDays,
        status: "APPROVED",
        managerName: `${actor.firstName} ${actor.lastName}`,
        remarks: `Logged directly by ${actor.firstName} ${actor.lastName} on your behalf.`,
      });
    } catch (err) {
      console.error("Failed to send logged-leave email:", err);
    }
  }
};

module.exports = { logLeaveForEmployee, sendLoggedLeaveEmails };
