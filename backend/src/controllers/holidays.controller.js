const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Active company holidays from today through the next `days` days (default 30).
// Available to any authenticated account - drives the employee dashboard's
// "Upcoming holidays" card.
const listUpcomingHolidays = asyncHandler(async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));

  const today = startOfUtcDay(new Date());
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() + days);

  const holidays = await prisma.holiday.findMany({
    where: { isActive: true, holidayDate: { gte: today, lte: until } },
    orderBy: { holidayDate: "asc" },
    select: { id: true, holidayName: true, holidayDate: true, isOptional: true },
  });

  new ApiResponse(200, "OK", { holidays, rangeDays: days }).send(res);
});

module.exports = { listUpcomingHolidays };
