const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const leaveCalendarService = require("../services/leaveCalendar.service");
const leaveBalanceService = require("../services/leaveBalance.service");
const companySettingsService = require("../services/companySettings.service");
const { sendLeaveDecisionEmail } = require("../utils/email.util");
const { UPLOAD_DIR } = require("../config/upload");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getOverview = asyncHandler(async (req, res) => {
  const managerId = req.user.id;
  const today = startOfUtcDay(new Date());

  const [totalEmployees, pendingRequestsCount, onLeaveTodayCount] = await Promise.all([
    prisma.user.count({ where: { managerId } }),
    prisma.leaveRequest.count({ where: { routedToId: managerId, status: "PENDING" } }),
    prisma.leaveRequest.count({
      where: { routedToId: managerId, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    }),
  ]);

  new ApiResponse(200, "OK", {
    totalEmployees,
    pendingRequestsCount,
    onLeaveTodayCount,
  }).send(res);
});

// "My employees" is a fixed roster: everyone whose profile currently names this
// manager - not derived from leave-request history.
const listEmployees = asyncHandler(async (req, res) => {
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();
  const managerId = req.user.id;

  const employees = await prisma.user.findMany({
    where: { managerId },
    orderBy: { firstName: "asc" },
    include: {
      leaveBalances: { where: { year: fiscalYear }, include: { leavePolicy: true } },
      leaveRequests: { where: { status: "PENDING" }, select: { id: true } },
    },
  });

  const result = employees.map((employee) => {
    const totalUsed = employee.leaveBalances.reduce((sum, b) => sum + b.usedLeaves, 0);
    const totalRemaining = employee.leaveBalances.reduce((sum, b) => sum + b.remainingLeaves, 0);
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      status: employee.status,
      pendingRequestsCount: employee.leaveRequests.length,
      totalUsed,
      totalRemaining,
      balances: employee.leaveBalances.map((b) => ({
        leaveName: b.leavePolicy.leaveName,
        allocatedLeaves: b.allocatedLeaves,
        usedLeaves: b.usedLeaves,
        remainingLeaves: b.remainingLeaves,
      })),
    };
  });

  new ApiResponse(200, "OK", { employees: result }).send(res);
});

const getEmployeeDetail = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== req.user.id) {
    throw ApiError.notFound("Employee not found.");
  }

  const [balances, leaveRequests] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: employeeId, year: fiscalYear },
      include: { leavePolicy: true },
    }),
    // Full history for this employee, including requests handled by a previous
    // manager - the current manager gets complete context, not just what
    // happened to be routed to them.
    prisma.leaveRequest.findMany({
      where: { userId: employeeId },
      include: {
        leavePolicy: true,
        routedTo: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  new ApiResponse(200, "OK", {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      status: employee.status,
      joiningDate: employee.joiningDate,
    },
    balances: balances.map((b) => ({
      leaveName: b.leavePolicy.leaveName,
      allocatedLeaves: b.allocatedLeaves,
      usedLeaves: b.usedLeaves,
      remainingLeaves: b.remainingLeaves,
    })),
    leaveRequests,
  }).send(res);
});

// Lets a manager log a leave directly for one of their direct reports -
// auto-approved at creation (creating it is the approval decision), skipping
// the self-service booking guardrails (advance-notice windows, past-date
// restrictions) since this is an authoritative record, not a request.
// Balance sufficiency and double-booking are still enforced.
const createLeaveForEmployee = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const { leavePolicyId, startDate, endDate, isHalfDay, reason } = req.body;

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== req.user.id) {
    throw ApiError.notFound("Employee not found.");
  }

  const leavePolicy = await prisma.leavePolicy.findFirst({ where: { id: leavePolicyId, isActive: true } });
  if (!leavePolicy) {
    throw ApiError.notFound("This leave type is not available.");
  }

  if (isHalfDay && !leavePolicy.allowHalfDay) {
    throw ApiError.badRequest(`${leavePolicy.leaveName} does not support half-day requests.`);
  }

  const requestStart = startOfUtcDay(startDate);
  const requestEnd = startOfUtcDay(endDate);

  const { totalDays } = await leaveCalendarService.computeWorkingDays({
    startDate: requestStart,
    endDate: requestEnd,
    isHalfDay,
  });

  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: employeeId,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: requestEnd },
      endDate: { gte: requestStart },
    },
  });
  if (overlapping) {
    throw ApiError.badRequest(`${employee.firstName} already has a leave request that overlaps these dates.`);
  }

  const requestFiscalYear = await companySettingsService.getFiscalYearForDate(requestStart);
  const balance = await leaveBalanceService.getOrCreateBalance(employeeId, leavePolicy, requestFiscalYear);
  if (!leavePolicy.isUnlimited && totalDays > balance.remainingLeaves) {
    throw ApiError.badRequest(
      `${employee.firstName} only has ${balance.remainingLeaves} day(s) of ${leavePolicy.leaveName} remaining.`
    );
  }

  await leaveBalanceService.applyUsage(balance.id, totalDays);

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: employeeId,
      leavePolicyId: leavePolicy.id,
      routedToId: req.user.id,
      approvedById: req.user.id,
      startDate: requestStart,
      endDate: requestEnd,
      totalDays,
      reason,
      status: "APPROVED",
      approvedAt: new Date(),
      createdByManager: true,
    },
    include: { leavePolicy: true },
  });

  new ApiResponse(201, "Leave logged and approved.", { leaveRequest }).send(res);

  // Sent after the response so the manager doesn't wait on the email round-trip.
  try {
    await sendLeaveDecisionEmail({
      to: employee.email,
      employeeFirstName: employee.firstName,
      leaveName: leavePolicy.leaveName,
      startDate: requestStart,
      endDate: requestEnd,
      totalDays,
      status: "APPROVED",
      managerName: `${req.user.firstName} ${req.user.lastName}`,
      remarks: `Logged directly by ${req.user.firstName} ${req.user.lastName} on your behalf.`,
    });
  } catch (err) {
    console.error("Failed to send manager-logged leave email:", err);
  }
});

const listTeamLeaveRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const requests = await prisma.leaveRequest.findMany({
    where: { routedToId: req.user.id, ...(status ? { status } : {}) },
    include: {
      leavePolicy: true,
      user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  new ApiResponse(200, "OK", { requests }).send(res);
});

const getRoutedLeaveRequestOr404 = async (id, routedToId) => {
  const leaveRequest = await prisma.leaveRequest.findFirst({
    where: { id, routedToId },
    include: { leavePolicy: true, user: true },
  });
  if (!leaveRequest) {
    throw ApiError.notFound("Leave request not found.");
  }
  return leaveRequest;
};

// Authorized if this request was routed to the manager, or - matching the
// "current manager gets full history" rule used elsewhere - if the request's
// owner is currently one of their direct reports, even if it was routed to a
// previous manager.
const getTeamLeaveRequestAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { user: { select: { managerId: true } } },
  });

  const isAuthorized =
    leaveRequest && (leaveRequest.routedToId === req.user.id || leaveRequest.user.managerId === req.user.id);

  if (!isAuthorized || !leaveRequest.attachmentUrl) {
    throw ApiError.notFound("No attachment found for this request.");
  }

  const filePath = path.join(UPLOAD_DIR, path.basename(leaveRequest.attachmentUrl));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

const approveLeaveRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const leaveRequest = await getRoutedLeaveRequestOr404(id, req.user.id);
  if (leaveRequest.status !== "PENDING") {
    throw ApiError.badRequest("This request has already been actioned.");
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

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: req.user.id,
      approvedAt: new Date(),
      managerRemarks: remarks || null,
    },
  });

  new ApiResponse(200, "Leave request approved.", { leaveRequest: updated }).send(res);

  // Sent after the response so the manager doesn't wait on the email round-trip.
  try {
    await sendLeaveDecisionEmail({
      to: leaveRequest.user.email,
      employeeFirstName: leaveRequest.user.firstName,
      leaveName: leaveRequest.leavePolicy.leaveName,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      status: "APPROVED",
      managerName: `${req.user.firstName} ${req.user.lastName}`,
      remarks: remarks || null,
    });
  } catch (err) {
    console.error("Failed to send leave approved email:", err);
  }
});

const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const leaveRequest = await getRoutedLeaveRequestOr404(id, req.user.id);
  if (leaveRequest.status !== "PENDING") {
    throw ApiError.badRequest("This request has already been actioned.");
  }

  const updated = await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: req.user.id,
      rejectedAt: new Date(),
      managerRemarks: remarks,
    },
  });

  new ApiResponse(200, "Leave request rejected.", { leaveRequest: updated }).send(res);

  // Sent after the response so the manager doesn't wait on the email round-trip.
  try {
    await sendLeaveDecisionEmail({
      to: leaveRequest.user.email,
      employeeFirstName: leaveRequest.user.firstName,
      leaveName: leaveRequest.leavePolicy.leaveName,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      totalDays: leaveRequest.totalDays,
      status: "REJECTED",
      managerName: `${req.user.firstName} ${req.user.lastName}`,
      remarks,
    });
  } catch (err) {
    console.error("Failed to send leave rejected email:", err);
  }
});

const getTeamCalendar = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const [calendar, teamLeaves] = await Promise.all([
    leaveCalendarService.getMonthCalendarData(year, month),
    // Current team's leave, regardless of which manager originally handled the
    // request - the calendar follows the current org chart.
    prisma.leaveRequest.findMany({
      where: {
        user: { managerId: req.user.id },
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: new Date(Date.UTC(year, month, 0)) },
        endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) },
      },
      include: { leavePolicy: true, user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  new ApiResponse(200, "OK", { ...calendar, teamLeaves }).send(res);
});

module.exports = {
  getOverview,
  listEmployees,
  getEmployeeDetail,
  createLeaveForEmployee,
  listTeamLeaveRequests,
  getTeamLeaveRequestAttachment,
  approveLeaveRequest,
  rejectLeaveRequest,
  getTeamCalendar,
};
