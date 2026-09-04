const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const leaveBalanceService = require("./leaveBalance.service");
const companySettingsService = require("./companySettings.service");
const notificationService = require("./notification.service");
const { sendLeaveDecisionEmail } = require("../utils/email.util");
const { formatDateShort } = require("../utils/formatDate.util");

// Shared approve/reject logic for a pending leave request, used by both the
// manager view (only requests routed to them) and the admin "All leave
// requests" view (any request). The caller is responsible for loading the
// request and checking that this actor is allowed to act on it - this service
// only enforces the request-state and balance rules.

// Applies the decision to the database (balance + status). Returns the updated
// row. Kept separate from the notifications below so the controller can send
// its HTTP response before the email round-trip.
const applyDecision = async ({ leaveRequest, actor, decision, remarks }) => {
  if (leaveRequest.status !== "PENDING") {
    throw ApiError.badRequest("This request has already been actioned.");
  }

  if (decision === "APPROVED") {
    // Can't be on leave and working from home the same day - if an
    // overlapping WFH request was already approved, that has to be sorted
    // out (cancelled) before the leave can be approved.
    const overlappingWfh = await prisma.wfhRequest.findFirst({
      where: {
        userId: leaveRequest.userId,
        status: "APPROVED",
        startDate: { lte: leaveRequest.endDate },
        endDate: { gte: leaveRequest.startDate },
      },
    });
    if (overlappingWfh) {
      throw ApiError.badRequest(
        `${leaveRequest.user.firstName} has an approved WFH request (${formatDateShort(
          overlappingWfh.startDate
        )} - ${formatDateShort(overlappingWfh.endDate)}) overlapping these dates. Cancel that WFH request first.`
      );
    }

    const requestFiscalYear = await companySettingsService.getFiscalYearForDate(leaveRequest.startDate);
    const balance = await leaveBalanceService.getOrCreateBalance(
      leaveRequest.userId,
      leaveRequest.leavePolicy,
      requestFiscalYear
    );

    if (!leaveRequest.leavePolicy.isUnlimited && leaveRequest.totalDays > balance.remainingLeaves) {
      throw ApiError.badRequest(
        `${leaveRequest.user.firstName} only has ${balance.remainingLeaves} day(s) of ${leaveRequest.leavePolicy.leaveName} remaining.`
      );
    }

    await leaveBalanceService.applyUsage(balance.id, leaveRequest.totalDays);

    return prisma.leaveRequest.update({
      where: { id: leaveRequest.id },
      data: {
        status: "APPROVED",
        approvedById: actor.id,
        approvedAt: new Date(),
        managerRemarks: remarks || null,
      },
    });
  }

  return prisma.leaveRequest.update({
    where: { id: leaveRequest.id },
    data: {
      status: "REJECTED",
      approvedById: actor.id,
      rejectedAt: new Date(),
      managerRemarks: remarks,
    },
  });
};

// Fire-and-forget email + in-app notification for the employee. Call after the
// HTTP response is sent; failures are logged, not surfaced.
const sendDecisionSideEffects = async ({ leaveRequest, actor, decision, remarks }) => {
  const actorName = `${actor.firstName} ${actor.lastName}`;

  try {
    await sendLeaveDecisionEmail({
      to: leaveRequest.user.email,
      employeeFirstName: leaveRequest.user.firstName,
      leaveName: leaveRequest.leavePolicy.leaveName,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      status: decision,
      managerName: actorName,
      remarks: remarks || null,
    });
  } catch (err) {
    console.error(`Failed to send leave ${decision.toLowerCase()} email:`, err);
  }

  try {
    const verb = decision === "APPROVED" ? "approved" : "rejected";
    await notificationService.notify({
      userId: leaveRequest.user.id,
      type: notificationService.NOTIFICATION_TYPES.LEAVE_DECIDED,
      title: `Leave request ${verb}`,
      message: `Your ${leaveRequest.leavePolicy.leaveName} request (${formatDateShort(
        leaveRequest.startDate
      )} - ${formatDateShort(leaveRequest.endDate)}) was ${verb} by ${actorName}.`,
    });
  } catch (err) {
    console.error(`Failed to create leave ${decision.toLowerCase()} notification:`, err);
  }
};

module.exports = { applyDecision, sendDecisionSideEffects };
