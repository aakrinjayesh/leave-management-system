const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const leaveCalendarService = require("../services/leaveCalendar.service");
const leaveBalanceService = require("../services/leaveBalance.service");
const companySettingsService = require("../services/companySettings.service");
const { sendLeaveSubmittedEmail, sendManagerOnLeaveNoticeEmail, sendLeaveCancelledEmail } = require("../utils/email.util");
const { UPLOAD_DIR } = require("../config/upload");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const formatBalance = (balance) => ({
  leavePolicyId: balance.leavePolicyId,
  leaveName: balance.leavePolicy.leaveName,
  allowHalfDay: balance.leavePolicy.allowHalfDay,
  isUnlimited: balance.leavePolicy.isUnlimited,
  allocatedLeaves: balance.allocatedLeaves,
  usedLeaves: balance.usedLeaves,
  remainingLeaves: balance.remainingLeaves,
});

const getBalancesForYear = async (userId, year) => {
  const policies = await prisma.leavePolicy.findMany({ where: { isActive: true } });
  const balances = await Promise.all(policies.map((policy) => leaveBalanceService.getOrCreateBalance(userId, policy, year)));
  return balances.map((balance, i) => formatBalance({ ...balance, leavePolicy: policies[i] }));
};

const getMyBalances = asyncHandler(async (req, res) => {
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();
  const balances = await getBalancesForYear(req.user.id, fiscalYear);

  new ApiResponse(200, "OK", { balances }).send(res);
});

const getMyLeaveRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const requests = await prisma.leaveRequest.findMany({
    where: { userId: req.user.id, ...(status ? { status } : {}) },
    include: {
      leavePolicy: true,
      routedTo: { select: { firstName: true, lastName: true } },
      approvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: "desc" },
  });

  new ApiResponse(200, "OK", { requests }).send(res);
});

const getDashboardSummary = asyncHandler(async (req, res) => {
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();
  const [balances, recentRequests, pendingCount] = await Promise.all([
    getBalancesForYear(req.user.id, fiscalYear),
    prisma.leaveRequest.findMany({
      where: { userId: req.user.id },
      include: { leavePolicy: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.leaveRequest.count({ where: { userId: req.user.id, status: "PENDING" } }),
  ]);

  new ApiResponse(200, "OK", { balances, recentRequests, pendingCount }).send(res);
});

const applyLeave = asyncHandler(async (req, res) => {
  const { leavePolicyId, startDate, endDate, isHalfDay, reason, attachmentUrl } = req.body;

  const leavePolicy = await prisma.leavePolicy.findFirst({ where: { id: leavePolicyId, isActive: true } });
  if (!leavePolicy) {
    throw ApiError.notFound("This leave type is not available.");
  }

  if (!req.user.managerId) {
    throw ApiError.badRequest("Please set your manager in your profile before applying for leave.");
  }

  const recipient = await prisma.user.findFirst({ where: { id: req.user.managerId, status: "ACTIVE" } });
  if (!recipient) {
    throw ApiError.badRequest("Your assigned manager's account isn't active. Please update your manager in your profile.");
  }

  if (isHalfDay && !leavePolicy.allowHalfDay) {
    throw ApiError.badRequest(`${leavePolicy.leaveName} does not support half-day requests.`);
  }

  const settings = await companySettingsService.getSettings();
  const today = startOfUtcDay(new Date());
  const requestStart = startOfUtcDay(startDate);
  const requestEnd = startOfUtcDay(endDate);

  if (!settings.allowPastLeave && requestStart < today) {
    throw ApiError.badRequest("You can't request leave for a past date.");
  }

  if (settings.allowFutureLeave) {
    const maxDate = new Date(today);
    maxDate.setUTCDate(maxDate.getUTCDate() + settings.maxFutureDays);
    if (requestStart > maxDate) {
      throw ApiError.badRequest(`You can only request leave up to ${settings.maxFutureDays} days in advance.`);
    }
  } else if (requestStart > today) {
    throw ApiError.badRequest("Future-dated leave requests aren't allowed.");
  }

  const { totalDays } = await leaveCalendarService.computeWorkingDays({
    startDate: requestStart,
    endDate: requestEnd,
    isHalfDay,
  });

  // Attachment override: once a request is longer than attachmentRequiredAboveDays,
  // a supporting document is mandatory - and having one raises the day cap and
  // lifts the maxAdvanceBookingDays window for this request.
  const needsAttachment =
    leavePolicy.attachmentRequiredAboveDays != null && totalDays > leavePolicy.attachmentRequiredAboveDays;
  if (needsAttachment && !attachmentUrl) {
    throw ApiError.badRequest(
      `${leavePolicy.leaveName} requests longer than ${leavePolicy.attachmentRequiredAboveDays} day(s) require a supporting document. Please upload one before submitting.`
    );
  }
  const attachmentUnlocked = needsAttachment && Boolean(attachmentUrl);

  // Per-policy override, e.g. Sick Leave can only be booked for today/tomorrow
  // regardless of the company-wide future-leave window above - unless a
  // qualifying attachment lifted that window.
  if (leavePolicy.maxAdvanceBookingDays != null && !attachmentUnlocked) {
    const maxAdvanceDate = new Date(today);
    maxAdvanceDate.setUTCDate(maxAdvanceDate.getUTCDate() + leavePolicy.maxAdvanceBookingDays);
    if (requestStart > maxAdvanceDate || requestEnd > maxAdvanceDate) {
      const dayWord = leavePolicy.maxAdvanceBookingDays === 1 ? "tomorrow" : `${leavePolicy.maxAdvanceBookingDays} day(s) from today`;
      throw ApiError.badRequest(`${leavePolicy.leaveName} can only be requested for today or ${dayWord}.`);
    }
  }

  // Minimum-notice rule for long requests, e.g. Casual Leave requests over 4
  // days need to be submitted at least 20 days ahead of the start date.
  if (
    leavePolicy.longRequestThresholdDays != null &&
    leavePolicy.longRequestMinNoticeDays != null &&
    totalDays > leavePolicy.longRequestThresholdDays
  ) {
    const gapDays = Math.round((requestStart - today) / (24 * 60 * 60 * 1000));
    if (gapDays <= leavePolicy.longRequestMinNoticeDays) {
      throw ApiError.badRequest(
        `${leavePolicy.leaveName} requests longer than ${leavePolicy.longRequestThresholdDays} day(s) must be submitted at least ${leavePolicy.longRequestMinNoticeDays} days in advance. Please contact your manager directly if this is urgent.`
      );
    }
  }

  const effectiveMaxLeavesPerRequest = attachmentUnlocked
    ? leavePolicy.maxLeavesPerRequestWithAttachment ?? leavePolicy.maxLeavesPerRequest
    : leavePolicy.maxLeavesPerRequest;
  if (!leavePolicy.isUnlimited && totalDays > effectiveMaxLeavesPerRequest) {
    throw ApiError.badRequest(
      `${leavePolicy.leaveName} requests can be at most ${effectiveMaxLeavesPerRequest} day(s). This request is ${totalDays} day(s).`
    );
  }

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: req.user.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: requestEnd },
      endDate: { gte: requestStart },
    },
  });
  if (overlapping) {
    throw ApiError.badRequest("You already have a leave request that overlaps these dates.");
  }

  const requestFiscalYear = await companySettingsService.getFiscalYearForDate(requestStart);
  const balance = await leaveBalanceService.getOrCreateBalance(req.user.id, leavePolicy, requestFiscalYear);
  if (!leavePolicy.isUnlimited && totalDays > balance.remainingLeaves) {
    throw ApiError.badRequest(
      `Insufficient balance. You have ${balance.remainingLeaves} day(s) of ${leavePolicy.leaveName} remaining.`
    );
  }

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: req.user.id,
      leavePolicyId: leavePolicy.id,
      routedToId: recipient.id,
      startDate: requestStart,
      endDate: requestEnd,
      totalDays,
      reason,
      status: "PENDING",
      attachmentUrl: attachmentUrl || null,
    },
    include: { leavePolicy: true, routedTo: { select: { firstName: true, lastName: true } } },
  });

  new ApiResponse(201, "Leave request submitted.", { leaveRequest }).send(res);

  // Notify the manager - sent after the response so the employee doesn't wait
  // on the email round-trip; failures here shouldn't fail the leave request itself.
  try {
    await sendLeaveSubmittedEmail({
      to: recipient.email,
      managerFirstName: recipient.firstName,
      employeeName: `${req.user.firstName} ${req.user.lastName}`,
      leaveName: leavePolicy.leaveName,
      startDate: requestStart,
      endDate: requestEnd,
      totalDays,
      reason,
    });
  } catch (err) {
    console.error("Failed to send leave request submitted email:", err);
  }

  // If the recipient manager currently has an approved leave covering today,
  // also notify their own manager as a backup, so the request doesn't sit
  // unseen while they're away.
  try {
    const recipientOnLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: recipient.id,
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    if (recipientOnLeave && recipient.managerId) {
      const escalationManager = await prisma.user.findFirst({
        where: { id: recipient.managerId, status: "ACTIVE" },
      });

      if (escalationManager) {
        await sendManagerOnLeaveNoticeEmail({
          to: escalationManager.email,
          escalationManagerFirstName: escalationManager.firstName,
          employeeName: `${req.user.firstName} ${req.user.lastName}`,
          recipientName: `${recipient.firstName} ${recipient.lastName}`,
          leaveName: leavePolicy.leaveName,
          startDate: requestStart,
          endDate: requestEnd,
          totalDays,
          reason,
        });
      }
    }
  } catch (err) {
    console.error("Failed to send manager-on-leave backup notice email:", err);
  }
});

// Uploaded ahead of submission, so the employee can review it before the
// actual leave request exists - the returned filename gets passed back in
// as attachmentUrl when they call applyLeave.
const uploadAttachment = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }

  new ApiResponse(201, "File uploaded.", {
    attachmentUrl: req.file.filename,
    fileName: req.file.originalname,
  }).send(res);
});

const getMyLeaveRequestAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const leaveRequest = await prisma.leaveRequest.findFirst({ where: { id, userId: req.user.id } });
  if (!leaveRequest || !leaveRequest.attachmentUrl) {
    throw ApiError.notFound("No attachment found for this request.");
  }

  const filePath = path.join(UPLOAD_DIR, path.basename(leaveRequest.attachmentUrl));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

const cancelLeaveRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { leavePolicy: true, routedTo: true },
  });
  if (!leaveRequest || leaveRequest.userId !== req.user.id) {
    throw ApiError.notFound("Leave request not found.");
  }

  if (leaveRequest.status !== "PENDING") {
    throw ApiError.badRequest(
      "This request has already been approved by your manager and can no longer be cancelled."
    );
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  new ApiResponse(200, "Leave request cancelled.", { leaveRequest: updated }).send(res);

  // Sent after the response so the employee doesn't wait on the email round-trip.
  if (leaveRequest.routedTo) {
    try {
      await sendLeaveCancelledEmail({
        to: leaveRequest.routedTo.email,
        managerFirstName: leaveRequest.routedTo.firstName,
        employeeName: `${req.user.firstName} ${req.user.lastName}`,
        leaveName: leaveRequest.leavePolicy.leaveName,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
      });
    } catch (err) {
      console.error("Failed to send leave cancelled email:", err);
    }
  }
});

const getMyCalendar = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const [calendar, myLeaves] = await Promise.all([
    leaveCalendarService.getMonthCalendarData(year, month),
    prisma.leaveRequest.findMany({
      where: {
        userId: req.user.id,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: new Date(Date.UTC(year, month, 0)) },
        endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) },
      },
      include: { leavePolicy: true },
    }),
  ]);

  new ApiResponse(200, "OK", { ...calendar, myLeaves }).send(res);
});

module.exports = {
  getMyBalances,
  getMyLeaveRequests,
  getDashboardSummary,
  applyLeave,
  uploadAttachment,
  getMyLeaveRequestAttachment,
  cancelLeaveRequest,
  getMyCalendar,
};
