const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { USER_STATUS } = require("../utils/constants");
const userManagerService = require("../services/userManager.service");
const timesheetService = require("../services/timesheet.service");
const companySettingsService = require("../services/companySettings.service");
const leaveCalendarService = require("../services/leaveCalendar.service");
const leaveBalanceService = require("../services/leaveBalance.service");
const { UPLOAD_DIR } = require("../config/upload");
const { TIMESHEET_ATTACHMENT_DIR } = require("../config/timesheetAttachmentUpload");

const toSafeUser = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  userType: user.userType,
  status: user.status,
  exitDate: user.exitDate,
  isPasswordSet: user.isPasswordSet,
  createdAt: user.createdAt,
  managerId: user.managerId,
  salaryCtc: user.salaryCtc,
  hasDocument: Boolean(user.documentUrl),
});

const listUsers = asyncHandler(async (req, res) => {
  const { userType } = req.query;

  const users = await prisma.user.findMany({
    where: userType ? { userType } : undefined,
    orderBy: [{ userType: "asc" }, { firstName: "asc" }],
  });

  new ApiResponse(200, "OK", { users: users.map(toSafeUser) }).send(res);
});

const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, userType } = req.body;

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
const reactivateUser = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const user = await prisma.user.update({
    where: { id },
    data: { status: USER_STATUS.ACTIVE, exitDate: null },
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

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const [entries, submissions] = await Promise.all([
    timesheetService.getSubmittedEntriesInRange(employeeId, start, end),
    timesheetService.getSubmissionsOverlappingRange(employeeId, start, end),
  ]);

  new ApiResponse(200, "OK", {
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, email: employee.email },
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

const getUserLeaveAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
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

// Full HR/payroll record for one user - admin-only, unmasked (unlike the
// user's own profile view, which masks bank account/PAN/UAN/Aadhaar).
const toFullUserDetails = (user) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  employeeCode: user.employeeCode,
  phone: user.phone,
  birthDate: user.birthDate,
  joiningDate: user.joiningDate,
  exitDate: user.exitDate,
  gender: user.gender,
  fatherName: user.fatherName,
  spouseName: user.spouseName,
  maritalStatus: user.maritalStatus,
  nationality: user.nationality,
  qualification: user.qualification,
  designation: user.designation,
  location: user.location,
  taxRegime: user.taxRegime,
  residentialAddress: user.residentialAddress,
  wardNo: user.wardNo,
  micrCode: user.micrCode,
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

  new ApiResponse(200, "OK", { user: toFullUserDetails(user), customFields }).send(res);
});

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

  const { start, end } = timesheetService.getViewRange(view, anchorDate);
  const entries = await timesheetService.getSubmittedEntriesInRange(employeeId, start, end);
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
  getUserTimesheet,
  getTimesheetSubmissionAttachment,
  exportUserTimesheet,
  exportPayrollTimesheet,
  getUserLeaveDetail,
  getUserCalendar,
  getUserLeaveAttachment,
  getUserDetails,
  updateUserDetails,
  getCompanySettings,
  updateCompanySettings,
};
