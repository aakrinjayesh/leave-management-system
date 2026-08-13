const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

// Notifies every active account - a leave policy change affects the whole
// company's leave rules, not just the admin who made it.
const notifyAllOfPolicyChange = async (message) => {
  try {
    const everyone = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
    await notificationService.notifyMany(
      everyone.map((u) => u.id),
      { type: notificationService.NOTIFICATION_TYPES.LEAVE_POLICY_CHANGED, title: "Leave policy updated", message }
    );
  } catch (err) {
    console.error("Failed to create leave policy changed notification:", err);
  }
};

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const today = () => startOfUtcDay(new Date());

// Every calendar day from start to end, inclusive - used to expand a
// holiday date range into one row per day (the Holiday model itself only
// ever represents a single day).
const buildDateRange = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

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

  await notifyAllOfPolicyChange(`A new leave type, ${policy.leaveName}, has been added.`);
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

  await notifyAllOfPolicyChange(`The ${policy.leaveName} leave policy has been updated.`);
});

const deactivateLeavePolicy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const policy = await prisma.leavePolicy.update({ where: { id }, data: { isActive: false } });
  new ApiResponse(200, "Leave type deactivated.", { policy }).send(res);

  await notifyAllOfPolicyChange(`The ${policy.leaveName} leave type has been deactivated.`);
});

const reactivateLeavePolicy = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const policy = await prisma.leavePolicy.update({ where: { id }, data: { isActive: true } });
  new ApiResponse(200, "Leave type reactivated.", { policy }).send(res);

  await notifyAllOfPolicyChange(`The ${policy.leaveName} leave type has been reactivated.`);
});

// Distinct fiscal years that have any leave-balance data on file, newest
// first - used to populate the "view a past year" dropdown. A year only
// shows up once at least one employee's balance has been created for it.
const getLeavePolicyHistoryYears = asyncHandler(async (req, res) => {
  const rows = await prisma.leaveBalance.findMany({
    distinct: ["year"],
    select: { year: true },
    orderBy: { year: "desc" },
  });
  new ApiResponse(200, "OK", { years: rows.map((r) => r.year) }).send(res);
});

// Read-only snapshot of what each leave type's allocation actually was for a
// past fiscal year - reconstructed from employees' LeaveBalance rows (which
// froze the allocation at the time each was created), since LeavePolicy
// itself only ever holds the current live value.
const getLeavePolicyHistory = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  if (!year) {
    throw ApiError.badRequest("Please provide a year.");
  }

  const policies = await prisma.leavePolicy.findMany({ orderBy: { leaveName: "asc" } });

  const history = await Promise.all(
    policies.map(async (policy) => {
      if (policy.isUnlimited) {
        return {
          id: policy.id,
          leaveName: policy.leaveName,
          isUnlimited: true,
          isUnpaid: policy.isUnpaid,
          allocatedLeaves: null,
          hasData: true,
        };
      }

      const sample = await prisma.leaveBalance.findFirst({
        where: { leavePolicyId: policy.id, year },
      });

      return {
        id: policy.id,
        leaveName: policy.leaveName,
        isUnlimited: false,
        isUnpaid: policy.isUnpaid,
        allocatedLeaves: sample ? sample.allocatedLeaves : null,
        hasData: Boolean(sample),
      };
    })
  );

  new ApiResponse(200, "OK", { year, policies: history }).send(res);
});

// ---------- Holidays ----------
// Only today-or-future dates can be added/edited/removed - past holidays are
// locked because leave requests may already have been computed against them.

const listHolidays = asyncHandler(async (req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { holidayDate: "asc" } });
  new ApiResponse(200, "OK", { holidays }).send(res);
});

const createHoliday = asyncHandler(async (req, res) => {
  const { holidayName, holidayEndDate, description, isOptional } = req.body;
  const holidayDate = startOfUtcDay(req.body.holidayDate);
  if (holidayDate < today()) {
    throw ApiError.badRequest("Holidays can only be added for today or a future date.");
  }

  // No end date (or same as start) is just the original single-day case -
  // holidayEndDate only ever widens it into a range of individual rows.
  const endDate = holidayEndDate ? startOfUtcDay(holidayEndDate) : holidayDate;
  const dates = buildDateRange(holidayDate, endDate);

  const clashes = await prisma.holiday.findMany({ where: { holidayDate: { in: dates } } });
  if (clashes.length > 0) {
    throw ApiError.badRequest(
      `A holiday is already set for ${formatDateShort(clashes[0].holidayDate)}${
        clashes.length > 1 ? ` and ${clashes.length - 1} other date(s) in this range` : ""
      }.`
    );
  }

  // One row per day, created together so a failure partway through can't
  // leave only some days of the range holidayed.
  const holidays = await prisma.$transaction(
    dates.map((date) =>
      prisma.holiday.create({
        data: {
          holidayName,
          holidayDate: date,
          description: description || null,
          isOptional: isOptional || false,
          createdById: req.user.id,
        },
      })
    )
  );

  const isRange = dates.length > 1;
  new ApiResponse(201, isRange ? `Holiday added for ${dates.length} days.` : "Holiday added.", {
    holiday: holidays[0],
    holidays,
  }).send(res);

  await notifyAllOfPolicyChange(
    isRange
      ? `A new holiday has been added: ${holidayName} (${formatDateShort(holidayDate)} - ${formatDateShort(endDate)}).`
      : `A new holiday has been added: ${holidayName} on ${formatDateShort(holidayDate)}.`
  );
});

const updateHoliday = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { holidayEndDate, ...rest } = req.body;

  const existing = await prisma.holiday.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Holiday not found.");
  }
  if (startOfUtcDay(existing.holidayDate) < today()) {
    throw ApiError.badRequest("Past holidays can't be edited.");
  }

  const data = { ...rest };
  let holidayDate = startOfUtcDay(existing.holidayDate);
  if (data.holidayDate) {
    holidayDate = startOfUtcDay(data.holidayDate);
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

  // No end date (or one equal to the start) is the original single-row
  // update. A later end date grows this holiday into a range - the row
  // being edited becomes the start day, and a new row is created for each
  // additional day on top of it.
  const endDate = holidayEndDate ? startOfUtcDay(holidayEndDate) : holidayDate;
  if (endDate < holidayDate) {
    throw ApiError.badRequest("End date can't be before the start date.");
  }
  if ((endDate.getTime() - holidayDate.getTime()) / 86400000 > 30) {
    throw ApiError.badRequest("A holiday range can span at most 31 days.");
  }

  const extraDates = buildDateRange(holidayDate, endDate).filter((d) => d.getTime() !== holidayDate.getTime());

  if (extraDates.length > 0) {
    const clashes = await prisma.holiday.findMany({ where: { holidayDate: { in: extraDates }, id: { not: id } } });
    if (clashes.length > 0) {
      throw ApiError.badRequest(
        `A holiday is already set for ${formatDateShort(clashes[0].holidayDate)}${
          clashes.length > 1 ? ` and ${clashes.length - 1} other date(s) in this range` : ""
        }.`
      );
    }
  }

  const [holiday, ...newHolidays] = await prisma.$transaction([
    prisma.holiday.update({ where: { id }, data }),
    ...extraDates.map((date) =>
      prisma.holiday.create({
        data: {
          holidayName: rest.holidayName ?? existing.holidayName,
          holidayDate: date,
          description: rest.description !== undefined ? rest.description : existing.description,
          isOptional: rest.isOptional !== undefined ? rest.isOptional : existing.isOptional,
          createdById: req.user.id,
        },
      })
    ),
  ]);

  const isRange = newHolidays.length > 0;
  new ApiResponse(200, isRange ? `Holiday updated and extended to ${newHolidays.length + 1} days.` : "Holiday updated.", {
    holiday,
    holidays: [holiday, ...newHolidays],
  }).send(res);

  await notifyAllOfPolicyChange(
    isRange
      ? `The ${holiday.holidayName} holiday has been updated (now ${formatDateShort(holidayDate)} - ${formatDateShort(
          endDate
        )}).`
      : `The ${holiday.holidayName} holiday has been updated (now ${formatDateShort(holiday.holidayDate)}).`
  );
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

  await notifyAllOfPolicyChange(
    `The ${holiday.holidayName} holiday on ${formatDateShort(holiday.holidayDate)} has been removed.`
  );
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

  await notifyAllOfPolicyChange(
    `The ${holiday.holidayName} holiday on ${formatDateShort(holiday.holidayDate)} has been restored.`
  );
});

module.exports = {
  listLeavePolicies,
  createLeavePolicy,
  updateLeavePolicy,
  deactivateLeavePolicy,
  reactivateLeavePolicy,
  getLeavePolicyHistoryYears,
  getLeavePolicyHistory,
  listHolidays,
  createHoliday,
  updateHoliday,
  deactivateHoliday,
  reactivateHoliday,
};
