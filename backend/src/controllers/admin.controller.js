const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { USER_STATUS, USER_TYPE } = require("../utils/constants");
const userManagerService = require("../services/userManager.service");
const timesheetService = require("../services/timesheet.service");
const projectService = require("../services/project.service");
const companySettingsService = require("../services/companySettings.service");
const leaveCalendarService = require("../services/leaveCalendar.service");
const leaveBalanceService = require("../services/leaveBalance.service");
const timesheetDecisionService = require("../services/timesheetDecision.service");
const notificationService = require("../services/notification.service");
const { sendAdminAccessRemovedEmail } = require("../utils/email.util");
const { isS3Url } = require("../utils/s3.util");
const { UPLOAD_DIR } = require("../config/upload");
const { TIMESHEET_ATTACHMENT_DIR } = require("../config/timesheetAttachmentUpload");

const toSafeUser = (user) => ({
  id: user.id,
  employeeCode: user.employeeCode,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  userType: user.userType,
  employmentType: user.employmentType,
  status: user.status,
  exitDate: user.exitDate,
  isPasswordSet: user.isPasswordSet,
  createdAt: user.createdAt,
  managerId: user.managerId,
  salaryCtc: user.salaryCtc,
  hasDocument: Boolean(user.documentUrl),
});

// Trailing digits of an employee code are one running sequence across every
// (varying) prefix - TECH-2026-001, SALE-2015-002, etc. Accounts with no code
// (or no number in it) sort after the numbered ones.
const employeeCodeSeq = (code) => {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const listUsers = asyncHandler(async (req, res) => {
  const { userType } = req.query;

  const users = await prisma.user.findMany({
    where: userType ? { userType } : undefined,
  });

  users.sort((a, b) => {
    const sa = employeeCodeSeq(a.employeeCode);
    const sb = employeeCodeSeq(b.employeeCode);
    if (sa !== sb) return sa - sb;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  new ApiResponse(200, "OK", { users: users.map(toSafeUser) }).send(res);
});

const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, userType, employmentType } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.badRequest("An account with this email already exists.");
  }

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      userType,
      employmentType,
      status: USER_STATUS.PENDING,
      isPasswordSet: false,
    },
  });

  new ApiResponse(201, "Account created. They can now activate it with this email.", {
    user: toSafeUser(user),
  }).send(res);
});

// Reactivating clears exitDate (the "current" convenience field) since
// they're active again - the ExitRecord history from adminExit.controller.js
// is untouched, so past relieving letters stay downloadable even after rehire.
//
// Status goes back to ACTIVE only if a password was ever set; an account that
// was exited while still PENDING (never onboarded) returns to PENDING so it
// still has to be activated rather than landing in an "active but can't log
// in" state.
const reactivateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Account not found.");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      status: existing.isPasswordSet ? USER_STATUS.ACTIVE : USER_STATUS.PENDING,
      exitDate: null,
    },
  });

  new ApiResponse(200, "Account reactivated.", { user: toSafeUser(user) }).send(res);
});

// Lets an admin set or correct anyone's manager, same effect as the
// self-service profile flow (including re-routing their pending requests).
const updateUserManager = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { managerId } = req.body;

  if (managerId === id) {
    throw ApiError.badRequest("A user can't be their own manager.");
  }

  if (managerId !== null) {
    const manager = await prisma.user.findFirst({ where: { id: managerId, status: USER_STATUS.ACTIVE } });
    if (!manager) {
      throw ApiError.badRequest("Please choose a valid active user as manager.");
    }
  }

  const user = await userManagerService.setUserManager(id, managerId);

  new ApiResponse(200, "Manager updated.", { user: toSafeUser(user) }).send(res);
});

// Promotes an existing account to Admin, or demotes an existing Admin back
// to a plain Employee - unlike Manager status (which is derived from who
// reports to whom), Admin is a stored flag that only ever changes here.
// Guards against locking the app out of admin access entirely and against an
// admin accidentally changing their own access.
const setAdminAccess = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { grant } = req.body;

  if (id === req.user.id) {
    throw ApiError.badRequest("You can't change your own admin access.");
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    throw ApiError.notFound("Account not found.");
  }

  // Only block if removing this person would leave zero admins who can
  // actually log in - i.e. no OTHER active admin remains. Demoting a
  // pending/inactive admin is always fine as long as one active admin is left.
  if (!grant && target.userType === USER_TYPE.ADMIN) {
    const otherActiveAdmins = await prisma.user.count({
      where: { userType: USER_TYPE.ADMIN, status: USER_STATUS.ACTIVE, id: { not: id } },
    });
    if (otherActiveAdmins === 0) {
      throw ApiError.badRequest("Can't remove the last admin account.");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { userType: grant ? USER_TYPE.ADMIN : USER_TYPE.EMPLOYEE },
  });

  new ApiResponse(200, grant ? "Admin access granted." : "Admin access removed.", {
    user: toSafeUser(user),
  }).send(res);

  const actingAdminName = `${req.user.firstName} ${req.user.lastName}`;

  if (grant) {
    try {
      await notificationService.notify({
        userId: user.id,
        type: notificationService.NOTIFICATION_TYPES.ADMIN_GRANTED,
        title: "You've been made an admin",
        message: `${actingAdminName} made you an admin - you can now manage accounts, reports, payslips, and every other admin page.`,
      });
    } catch (err) {
      console.error("Failed to create admin granted notification:", err);
    }
  } else {
    // Sent after the response so the acting admin doesn't wait on the email round-trip.
    try {
      await sendAdminAccessRemovedEmail({ to: user.email, firstName: user.firstName, removedByName: actingAdminName });
    } catch (err) {
      console.error("Failed to send admin access removed email:", err);
    }

    try {
      await notificationService.notify({
        userId: user.id,
        type: notificationService.NOTIFICATION_TYPES.ADMIN_REMOVED,
        title: "Admin access removed",
        message: `${actingAdminName} removed your admin access. You now have a regular employee account.`,
      });
    } catch (err) {
      console.error("Failed to create admin removed notification:", err);
    }
  }
});

// Unrestricted version of the manager's employee-timesheet view - Admin can
// look at anyone, not just their own direct reports.
const getUserTimesheet = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const view = ["day", "week", "month"].includes(req.query.view) ? req.query.view : "week";
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  // An employee assigned to several projects has a separate timesheet per
  // project - default to whichever one was requested, or their first
  // project if none was specified (e.g. following a plain "Timesheet" link
  // rather than a specific project row).
  const projects = await projectService.listProjectsForEmployee(employeeId);
  const requestedProjectId = req.query.projectId ? Number(req.query.projectId) : null;
  const projectId =
    requestedProjectId && projects.some((p) => p.id === requestedProjectId) ? requestedProjectId : projects[0]?.id ?? null;

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const [entries, submissions] = await Promise.all([
    timesheetService.getSubmittedEntriesInRange(employeeId, start, end, projectId),
    timesheetService.getSubmissionsOverlappingRange(employeeId, start, end, projectId),
  ]);

  new ApiResponse(200, "OK", {
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email },
    projects,
    projectId,
    view,
    rangeStart: start,
    rangeEnd: end,
    entries,
    submissions,
    totalHours: timesheetService.sumHours(entries),
  }).send(res);
});

// The Excel sheet an employee attached to one of their weekly submissions -
// admin can download any employee's, unrestricted (unlike the manager
// version, which is scoped to routedToId).
const getTimesheetSubmissionAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const submission = await prisma.timesheetSubmission.findUnique({ where: { id } });
  if (!submission || !submission.attachmentStoredName) {
    throw ApiError.notFound("No attachment found for this submission.");
  }

  if (isS3Url(submission.attachmentStoredName)) {
    return res.redirect(submission.attachmentStoredName);
  }

  // Legacy attachment uploaded before the S3 migration - still on local disk.
  const filePath = path.join(TIMESHEET_ATTACHMENT_DIR, path.basename(submission.attachmentStoredName));
  res.download(filePath, submission.attachmentOriginalName || submission.attachmentStoredName, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Attachment file not found." });
    }
  });
});

// Unrestricted version of the manager's employee-detail view (balances +
// leave history) - Admin can look at anyone, not just their own direct reports.
const getUserLeaveDetail = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const fiscalYear = await companySettingsService.getCurrentFiscalYear();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  const [balances, leaveRequests, ledgers] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: employeeId, year: fiscalYear },
      include: { leavePolicy: true },
    }),
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

// Month calendar for one employee, scoped to APPROVED leave only (no
// pending) so admin sees actual days taken, not requests still in review.
const getUserCalendar = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  const [calendar, leaves] = await Promise.all([
    leaveCalendarService.getMonthCalendarData(year, month),
    prisma.leaveRequest.findMany({
      where: {
        userId: employeeId,
        status: "APPROVED",
        startDate: { lte: new Date(Date.UTC(year, month, 0)) },
        endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) },
      },
      include: { leavePolicy: true },
    }),
  ]);

  new ApiResponse(200, "OK", { ...calendar, leaves }).send(res);
});

// Company-wide month calendar - every non-admin employee's leave (pending +
// approved) and approved WFH on one calendar. The admin equivalent of the
// manager's team calendar, with no reporting-line filter.
const getCompanyCalendar = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const rangeEnd = new Date(Date.UTC(year, month, 0));
  const rangeStart = new Date(Date.UTC(year, month - 1, 1));

  const [calendar, teamLeaves, teamWfh] = await Promise.all([
    leaveCalendarService.getMonthCalendarData(year, month),
    prisma.leaveRequest.findMany({
      where: {
        user: { userType: { not: "ADMIN" } },
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
      include: { leavePolicy: true, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.wfhRequest.findMany({
      where: {
        user: { userType: { not: "ADMIN" } },
        status: "APPROVED",
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  new ApiResponse(200, "OK", { ...calendar, teamLeaves, teamWfh }).send(res);
});

const getUserLeaveAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leaveRequest || !leaveRequest.attachmentUrl) {
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

// Full HR/payroll record for one user - admin-only, unmasked (unlike the
// user's own profile view, which masks bank account/PAN/UAN/Aadhaar).
const toFullUserDetails = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  personalEmail: user.personalEmail,
  employeeCode: user.employeeCode,
  employmentType: user.employmentType,
  phone: user.phone,
  birthDate: user.birthDate,
  joiningDate: user.joiningDate,
  exitDate: user.exitDate,
  gender: user.gender,
  fatherName: user.fatherName,
  fatherMotherPhone: user.fatherMotherPhone,
  spouseName: user.spouseName,
  maritalStatus: user.maritalStatus,
  nationality: user.nationality,
  qualification: user.qualification,
  designation: user.designation,
  location: user.location,
  taxRegime: user.taxRegime,
  residentialAddress: user.residentialAddress,
  pinCode: user.pinCode,
  residentialStatus: user.residentialStatus,
  pan: user.pan,
  panHolderName: user.panHolderName,
  panDocumentUrl: user.panDocumentUrl,
  uan: user.uan,
  aadharNumber: user.aadharNumber,
  aadharHolderName: user.aadharHolderName,
  aadharDocumentUrl: user.aadharDocumentUrl,
  bankAccountNumber: user.bankAccountNumber,
  bankName: user.bankName,
  ifscCode: user.ifscCode,
  bankDocumentUrl: user.bankDocumentUrl,
  pfNumber: user.pfNumber,
  salaryCtc: user.salaryCtc,
  photoUrl: user.photoUrl,
});

const getUserDetails = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  const customFields = await prisma.employeeCustomField.findMany({
    where: { userId: id },
    orderBy: { createdAt: "asc" },
  });

  new ApiResponse(200, "OK", {
    user: toFullUserDetails(user),
    customFields,
    nextEmployeeCodeNumber: await nextEmployeeCodeNumber(),
  }).send(res);
});

// The next running number for an employee code, derived from the trailing
// digits of every existing code (prefixes vary - TECH-2023-001, SALE-2015-002,
// etc - but the tail number is a single sequence). Zero-padded to 3 digits,
// grows past that (012, 013, ... 100). Just a hint shown next to the field -
// the admin still types the full code.
const nextEmployeeCodeNumber = async () => {
  const rows = await prisma.user.findMany({
    where: { employeeCode: { not: null } },
    select: { employeeCode: true },
  });
  const maxSeq = rows.reduce((max, { employeeCode }) => {
    const match = employeeCode.match(/(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return String(maxSeq + 1).padStart(3, "0");
};

const updateUserDetails = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Account not found.");
  }

  if (req.body.employeeCode) {
    const codeTaken = await prisma.user.findFirst({
      where: { employeeCode: req.body.employeeCode, id: { not: id } },
    });
    if (codeTaken) {
      throw ApiError.badRequest("This employee code is already assigned to someone else.");
    }
  }

  const user = await prisma.user.update({ where: { id }, data: req.body });

  new ApiResponse(200, "Details updated.", { user: toFullUserDetails(user) }).send(res);
});

const sendCsv = (res, filename, csv) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
};

// Same data as getUserTimesheet, as a downloadable CSV instead of JSON.
const exportUserTimesheet = asyncHandler(async (req, res) => {
  const employeeId = Number(req.params.id);
  const view = ["day", "week", "month"].includes(req.query.view) ? req.query.view : "week";
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();

  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  const projectId = req.query.projectId ? Number(req.query.projectId) : null;
  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const entries = await timesheetService.getSubmittedEntriesInRange(employeeId, start, end, projectId);
  const { csv, filename } = timesheetService.buildEmployeeTimesheetCsv({
    employee,
    view,
    rangeStart: start,
    rangeEnd: end,
    entries,
    totalHours: timesheetService.sumHours(entries),
  });

  sendCsv(res, filename, csv);
});

// Company-wide payroll export: one row per active employee with their total
// submitted hours for the given month.
const exportPayrollTimesheet = asyncHandler(async (req, res) => {
  const anchorDate = req.query.date ? new Date(req.query.date) : new Date();
  const { start, end } = timesheetService.getViewRange("month", anchorDate);

  const { csv, filename } = await timesheetService.buildPayrollCsv(start, end);

  sendCsv(res, filename, csv);
});

// ---------- All timesheets (admin-wide) ----------
// One row per non-admin employee with their weekly-submission counts by status
// and total submitted hours this month. The admin acts on individual weekly
// submissions from the per-employee timesheet page.

const listEmployeeTimesheetSummary = asyncHandler(async (req, res) => {
  const { start, end } = timesheetService.getViewRange("month", new Date());

  const employees = await prisma.user.findMany({
    where: { userType: { not: "ADMIN" } },
    orderBy: { firstName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      status: true,
      timesheetSubmissions: { select: { status: true } },
    },
  });

  const result = await Promise.all(
    employees.map(async (employee) => {
      const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
      for (const submission of employee.timesheetSubmissions) {
        counts[submission.status] = (counts[submission.status] || 0) + 1;
      }
      const entries = await timesheetService.getSubmittedEntriesInRange(employee.id, start, end);

      return {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        employeeCode: employee.employeeCode,
        status: employee.status,
        pendingCount: counts.PENDING,
        approvedCount: counts.APPROVED,
        rejectedCount: counts.REJECTED,
        totalSubmissions: employee.timesheetSubmissions.length,
        hoursThisMonth: timesheetService.sumHours(entries),
      };
    })
  );

  new ApiResponse(200, "OK", { employees: result }).send(res);
});

const decideTimesheetSubmission = (decision) =>
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { remarks } = req.body;

    const submission = await prisma.timesheetSubmission.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!submission) {
      throw ApiError.notFound("Timesheet submission not found.");
    }

    const updated = await timesheetDecisionService.applyDecision({
      submission,
      actor: req.user,
      decision,
      remarks,
    });

    new ApiResponse(
      200,
      decision === "APPROVED" ? "Timesheet approved." : "Timesheet rejected.",
      { submission: updated }
    ).send(res);

    await timesheetDecisionService.sendDecisionSideEffects({ submission, actor: req.user, decision, remarks });
  });

const approveTimesheetSubmission = decideTimesheetSubmission("APPROVED");
const rejectTimesheetSubmission = decideTimesheetSubmission("REJECTED");

const getCompanySettings = asyncHandler(async (req, res) => {
  const settings = await companySettingsService.getSettings();
  new ApiResponse(200, "OK", { settings }).send(res);
});

const updateCompanySettings = asyncHandler(async (req, res) => {
  const settings = await companySettingsService.updateSettings(req.body);
  new ApiResponse(200, "Company settings updated.", { settings }).send(res);
});

module.exports = {
  listUsers,
  createUser,
  reactivateUser,
  updateUserManager,
  setAdminAccess,
  getUserTimesheet,
  getTimesheetSubmissionAttachment,
  exportUserTimesheet,
  exportPayrollTimesheet,
  listEmployeeTimesheetSummary,
  approveTimesheetSubmission,
  rejectTimesheetSubmission,
  getUserLeaveDetail,
  getUserCalendar,
  getCompanyCalendar,
  getUserLeaveAttachment,
  getUserDetails,
  updateUserDetails,
  getCompanySettings,
  updateCompanySettings,
};
