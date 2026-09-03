const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const leaveCalendarService = require("../services/leaveCalendar.service");
const leaveBalanceService = require("../services/leaveBalance.service");
const companySettingsService = require("../services/companySettings.service");
const leaveLogService = require("../services/leaveLog.service");
const leaveDecisionService = require("../services/leaveDecision.service");
const { isS3Url } = require("../utils/s3.util");
const { UPLOAD_DIR } = require("../config/upload");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const getOverview = asyncHandler(async (req, res) => {
  const managerId = req.user.id;
  const today = startOfUtcDay(new Date());

  const [totalEmployees, pendingRequestsCount, onLeaveTodayCount, wfhTodayCount] = await Promise.all([
    prisma.user.count({ where: { managerId } }),
    prisma.leaveRequest.count({ where: { routedToId: managerId, status: "PENDING" } }),
    prisma.leaveRequest.count({
      where: { routedToId: managerId, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    }),
    prisma.wfhRequest.count({
      where: { user: { managerId }, status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    }),
  ]);

  new ApiResponse(200, "OK", {
    totalEmployees,
    pendingRequestsCount,
    onLeaveTodayCount,
    wfhTodayCount,
  }).send(res);
});

// "My employees" is a fixed roster: everyone whose profile currently names this
// manager - not derived from leave-request history.
const listEmployees = asyncHandler(async (req, res) => {
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();
  const managerId = req.user.id;

  // Full yearly entitlement across every countable leave type - used as the
  // "remaining" fallback for an employee who has no balance rows yet (pending
  // account, or just never applied for leave), so the column reads the real
  // allocation instead of a misleading 0.
  const activePolicies = await prisma.leavePolicy.findMany({
    where: { isActive: true, isUnlimited: false },
    select: { allocatedLeaves: true },
  });
  const fullEntitlement = activePolicies.reduce((sum, p) => sum + p.allocatedLeaves, 0);

  const employees = await prisma.user.findMany({
    where: { managerId },
    orderBy: { firstName: "asc" },
    include: {
      leaveBalances: { where: { year: fiscalYear }, include: { leavePolicy: true } },
      leaveRequests: { where: { status: "PENDING" }, select: { id: true } },
      // Every project this employee is currently on - each membership's
      // assignedAt is when THEY joined that project, separate from the
      // project's own startDate (when the project itself began).
      projectMemberships: {
        include: { project: { select: { name: true, startDate: true, endDate: true } } },
        orderBy: { assignedAt: "desc" },
      },
    },
  });

  const result = employees.map((employee) => {
    const hasBalances = employee.leaveBalances.length > 0;
    const totalUsed = employee.leaveBalances.reduce((sum, b) => sum + b.usedLeaves, 0);
    const totalRemaining = hasBalances
      ? employee.leaveBalances.reduce((sum, b) => sum + b.remainingLeaves, 0)
      : fullEntitlement;
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
      projects: employee.projectMemberships.map((m) => ({
        projectName: m.project.name,
        projectStartDate: m.project.startDate,
        projectEndDate: m.project.endDate,
        assignedAt: m.assignedAt,
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

  const [balances, leaveRequests, ledgers] = await Promise.all([
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
    leaveBalanceService.getAllLedgersForUser(employeeId, fiscalYear),
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
    ledgers,
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

  const { leaveRequests, wasSplit, leavePolicy } = await leaveLogService.logLeaveForEmployee({
    employee,
    actor: req.user,
    leavePolicyId,
    startDate,
    endDate,
    isHalfDay,
    reason,
  });

  new ApiResponse(
    201,
    wasSplit
      ? `Leave logged and approved - only part of it was covered by ${employee.firstName}'s ${leavePolicy.leaveName} balance, so the rest was booked as Unpaid Leave.`
      : "Leave logged and approved.",
    { leaveRequests }
  ).send(res);

  await leaveLogService.sendLoggedLeaveEmails({ leaveRequests, employee, actor: req.user });
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

  if (isS3Url(leaveRequest.attachmentUrl)) {
    return res.redirect(leaveRequest.attachmentUrl);
  }

  // Legacy attachment uploaded before the S3 migration - still on local disk.
  const filePath = path.join(UPLOAD_DIR, path.basename(leaveRequest.attachmentUrl));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

const decideLeaveRequest = (decision) =>
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { remarks } = req.body;

    const leaveRequest = await getRoutedLeaveRequestOr404(id, req.user.id);

    const updated = await leaveDecisionService.applyDecision({
      leaveRequest,
      actor: req.user,
      decision,
      remarks,
    });

    new ApiResponse(
      200,
      decision === "APPROVED" ? "Leave request approved." : "Leave request rejected.",
      { leaveRequest: updated }
    ).send(res);

    await leaveDecisionService.sendDecisionSideEffects({ leaveRequest, actor: req.user, decision, remarks });
  });

const approveLeaveRequest = decideLeaveRequest("APPROVED");
const rejectLeaveRequest = decideLeaveRequest("REJECTED");

const getTeamCalendar = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const [calendar, teamLeaves, teamWfh] = await Promise.all([
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
    // Approved only - matches the same rule as the employee's own calendar.
    prisma.wfhRequest.findMany({
      where: {
        user: { managerId: req.user.id },
        status: "APPROVED",
        startDate: { lte: new Date(Date.UTC(year, month, 0)) },
        endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) },
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  new ApiResponse(200, "OK", { ...calendar, teamLeaves, teamWfh }).send(res);
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
