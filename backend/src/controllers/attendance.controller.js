const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const attendanceService = require("../services/attendance.service");
const notificationStreamService = require("../services/notificationStream.service");

const parseYearMonth = (req) => {
  const now = new Date();
  const year = Number(req.query.year) || now.getUTCFullYear();
  const month = Number(req.query.month) || now.getUTCMonth() + 1;
  if (month < 1 || month > 12) {
    throw ApiError.badRequest("Invalid month.");
  }
  return { year, month };
};

// -------------------------------- employee --------------------------------

// One mark per day, applied to every project the employee is on - any
// projectId sent by older clients is ignored.
const markAttendance = asyncHandler(async (req, res) => {
  const date = req.body.date ? String(req.body.date).slice(0, 10) : null;
  const status = req.body.status || "PRESENT";

  const result = await attendanceService.markAttendance(req.user.id, date, status);
  // Lets any open attendance roster re-fetch right away (replaces its old
  // 30s poll).
  notificationStreamService.broadcast("attendance");

  const MESSAGES = { CLEAR: "Attendance cleared.", ABSENT: "Marked absent.", HALF_DAY: "Marked half day." };
  const message = MESSAGES[status] || "Marked present.";
  new ApiResponse(200, message, result).send(res);
});

const getMyAttendance = asyncHandler(async (req, res) => {
  const { year, month } = parseYearMonth(req);
  const data = await attendanceService.getMyAttendance(req.user.id, year, month);
  new ApiResponse(200, "OK", data).send(res);
});

// ---------------------------- manager / admin ----------------------------

const getTeamAttendance = asyncHandler(async (req, res) => {
  const { year, month } = parseYearMonth(req);
  const data = await attendanceService.getRosterAttendance({
    userWhere: { managerId: req.user.id },
    year,
    month,
  });
  new ApiResponse(200, "OK", data).send(res);
});

const getCompanyAttendance = asyncHandler(async (req, res) => {
  const { year, month } = parseYearMonth(req);
  const data = await attendanceService.getRosterAttendance({
    // Everyone assigned to a project, admins included - they mark their own
    // attendance now too.
    userWhere: {},
    year,
    month,
  });
  new ApiResponse(200, "OK", data).send(res);
});

const correctAttendance = asyncHandler(async (req, res) => {
  const { userId, date, action, note } = req.body;
  if (!userId || !date || !action) {
    throw ApiError.badRequest("userId, date and a valid action are required.");
  }

  const result = await attendanceService.correctAttendance({
    adminId: req.user.id,
    userId: Number(userId),
    dateKey: String(date).slice(0, 10),
    action,
    note,
  });
  notificationStreamService.broadcast("attendance");

  new ApiResponse(200, "Attendance updated.", result).send(res);
});

// Admin - lock / unlock one month for employees. Body (lock) or query
// (unlock): { year, month }.
const parseLockMonth = (source) => {
  const year = Number(source.year);
  const month = Number(source.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw ApiError.badRequest("A valid year and month are required.");
  }
  return { year, month };
};

const lockMonth = asyncHandler(async (req, res) => {
  const { year, month } = parseLockMonth(req.body);
  const monthLock = await attendanceService.lockMonth(year, month, req.user.id, "MANUAL");
  notificationStreamService.broadcast("attendance");
  new ApiResponse(200, "Month locked. Employees can no longer change its attendance.", { monthLock }).send(res);
});

const unlockMonth = asyncHandler(async (req, res) => {
  const { year, month } = parseLockMonth(req.query);
  await attendanceService.unlockMonth(year, month);
  notificationStreamService.broadcast("attendance");
  new ApiResponse(200, "Month unlocked. Employees can change its attendance again.", { monthLock: null }).send(res);
});

module.exports = {
  markAttendance,
  getMyAttendance,
  getTeamAttendance,
  getCompanyAttendance,
  correctAttendance,
  lockMonth,
  unlockMonth,
};
