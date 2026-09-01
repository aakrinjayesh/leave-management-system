const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const attendanceService = require("../services/attendance.service");

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

const markAttendance = asyncHandler(async (req, res) => {
  const projectId = Number(req.body.projectId);
  if (!projectId) {
    throw ApiError.badRequest("Please choose a project.");
  }
  const date = req.body.date ? String(req.body.date).slice(0, 10) : null;
  const status = req.body.status || "PRESENT";

  const result = await attendanceService.markAttendance(req.user.id, projectId, date, status);

  const message =
    status === "ABSENT" ? "Attendance cleared." : status === "HALF_DAY" ? "Marked half day." : "Marked present.";
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
    userWhere: { userType: { not: "ADMIN" } },
    year,
    month,
  });
  new ApiResponse(200, "OK", data).send(res);
});

const correctAttendance = asyncHandler(async (req, res) => {
  const { userId, projectId, date, action, note } = req.body;
  if (!userId || !projectId || !date || !["PRESENT", "HALF_DAY", "ABSENT"].includes(action)) {
    throw ApiError.badRequest("userId, projectId, date and a valid action are required.");
  }

  const result = await attendanceService.correctAttendance({
    adminId: req.user.id,
    userId: Number(userId),
    projectId: Number(projectId),
    dateKey: String(date).slice(0, 10),
    action,
    note,
  });

  new ApiResponse(200, "Attendance updated.", result).send(res);
});

module.exports = {
  markAttendance,
  getMyAttendance,
  getTeamAttendance,
  getCompanyAttendance,
  correctAttendance,
};
