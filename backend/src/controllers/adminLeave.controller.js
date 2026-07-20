const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const today = () => startOfUtcDay(new Date());

// ---------- Leave Policies ----------
// Editing/creating a policy only ever changes the LeavePolicy row itself.
// Existing LeaveBalance rows (already created for employees this year) are
// never touched here, so allocation changes only take effect for balances
// not yet created (new joiners, or next time a balance is lazily created).

const listLeavePolicies = asyncHandler(async (req, res) => {
  const policies = await prisma.leavePolicy.findMany({ orderBy: { leaveName: "asc" } });
  new ApiResponse(200, "OK", { policies }).send(res);
});

const createLeavePolicy = asyncHandler(async (req, res) => {
  const existing = await prisma.leavePolicy.findUnique({ where: { leaveName: req.body.leaveName } });
  if (existing) {
    throw ApiError.badRequest("A leave type with this name already exists.");
  }

  const policy = await prisma.leavePolicy.create({ data: req.body });
  new ApiResponse(201, "Leave type created.", { policy }).send(res);
});

const updateLeavePolicy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.leavePolicy.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Leave type not found.");
  }

  if (req.body.leaveName && req.body.leaveName !== existing.leaveName) {
    const nameTaken = await prisma.leavePolicy.findUnique({ where: { leaveName: req.body.leaveName } });
    if (nameTaken) {
      throw ApiError.badRequest("A leave type with this name already exists.");
    }
  }

  const policy = await prisma.leavePolicy.update({ where: { id }, data: req.body });
  new ApiResponse(200, "Leave type updated.", { policy }).send(res);
});

const deactivateLeavePolicy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const policy = await prisma.leavePolicy.update({ where: { id }, data: { isActive: false } });
  new ApiResponse(200, "Leave type deactivated.", { policy }).send(res);
});

const reactivateLeavePolicy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const policy = await prisma.leavePolicy.update({ where: { id }, data: { isActive: true } });
  new ApiResponse(200, "Leave type reactivated.", { policy }).send(res);
});

// ---------- Holidays ----------
// Only today-or-future dates can be added/edited/removed - past holidays are
// locked because leave requests may already have been computed against them.

const listHolidays = asyncHandler(async (req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { holidayDate: "asc" } });
  new ApiResponse(200, "OK", { holidays }).send(res);
});

const createHoliday = asyncHandler(async (req, res) => {
  const holidayDate = startOfUtcDay(req.body.holidayDate);
  if (holidayDate < today()) {
    throw ApiError.badRequest("Holidays can only be added for today or a future date.");
  }

  const existing = await prisma.holiday.findUnique({ where: { holidayDate } });
  if (existing) {
    throw ApiError.badRequest("A holiday is already set for this date.");
  }

  const holiday = await prisma.holiday.create({
    data: { ...req.body, holidayDate, createdById: req.user.id },
  });
  new ApiResponse(201, "Holiday added.", { holiday }).send(res);
});

const updateHoliday = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Holiday not found.");
  }
  if (startOfUtcDay(existing.holidayDate) < today()) {
    throw ApiError.badRequest("Past holidays can't be edited.");
  }

  const data = { ...req.body };
  if (data.holidayDate) {
    const holidayDate = startOfUtcDay(data.holidayDate);
    if (holidayDate < today()) {
      throw ApiError.badRequest("Holidays can only be set for today or a future date.");
    }
    if (holidayDate.getTime() !== existing.holidayDate.getTime()) {
      const clash = await prisma.holiday.findUnique({ where: { holidayDate } });
      if (clash) {
        throw ApiError.badRequest("A holiday is already set for this date.");
      }
    }
    data.holidayDate = holidayDate;
  }

  const holiday = await prisma.holiday.update({ where: { id }, data });
  new ApiResponse(200, "Holiday updated.", { holiday }).send(res);
});

const deactivateHoliday = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Holiday not found.");
  }
  if (startOfUtcDay(existing.holidayDate) < today()) {
    throw ApiError.badRequest("Past holidays can't be removed.");
  }

  const holiday = await prisma.holiday.update({ where: { id }, data: { isActive: false } });
  new ApiResponse(200, "Holiday removed.", { holiday }).send(res);
});

const reactivateHoliday = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Holiday not found.");
  }
  if (startOfUtcDay(existing.holidayDate) < today()) {
    throw ApiError.badRequest("Past holidays can't be restored.");
  }

  const holiday = await prisma.holiday.update({ where: { id }, data: { isActive: true } });
  new ApiResponse(200, "Holiday restored.", { holiday }).send(res);
});

module.exports = {
  listLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  deactivateLeavePolicy,
  reactivateLeavePolicy,
  listHolidays,
  createHoliday,
  updateHoliday,
  deactivateHoliday,
  reactivateHoliday,
};
