const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

const WEEKDAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const NTH_WEEK_NAMES = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH"];

const toDateKey = (date) => date.toISOString().slice(0, 10);

const getWeekdayName = (date) => WEEKDAY_NAMES[date.getUTCDay()];

const getNthWeekName = (date) => NTH_WEEK_NAMES[Math.floor((date.getUTCDate() - 1) / 7)];

const eachDate = function* (startDate, endDate) {
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  while (cursor <= last) {
    yield new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
};

const getWeekendPolicies = () => prisma.weekendPolicy.findMany({ where: { isHoliday: true } });

const getHolidaysInRange = (startDate, endDate) =>
  prisma.holiday.findMany({
    where: { isActive: true, holidayDate: { gte: startDate, lte: endDate } },
  });

const isWeekendDate = (date, weekendPolicies) => {
  const dayName = getWeekdayName(date);
  const matching = weekendPolicies.filter((p) => p.dayOfWeek === dayName);
  if (matching.length === 0) return false;
  if (matching.some((p) => p.weekNumber === "ALL")) return true;
  const nthWeekName = getNthWeekName(date);
  return matching.some((p) => p.weekNumber === nthWeekName);
};

// Computes how many working days a leave request spans, excluding weekends
// (per WeekendPolicy) and company holidays. Throws if the range contains no
// working days at all (e.g. a request that's entirely a weekend/holiday).
//
// applySandwichRule (Casual Leave only - see the caller) additionally charges
// a weekend date if it's "sandwiched": there's a real working day earlier in
// this SAME request and another real working day later in it, i.e. the
// employee's leave resumes on the other side of the weekend rather than just
// ending at it. Scoped to one continuous request only - it never looks at
// any other leave request. Holidays are never swept in this way even when
// sandwiched, since they're a company-wide day off regardless of leave.
const computeWorkingDays = async ({ startDate, endDate, isHalfDay, applySandwichRule = false }) => {
  if (isHalfDay && startDate.getTime() !== endDate.getTime()) {
    throw ApiError.badRequest("Half-day leave must have the same start and end date.");
  }

  const [weekendPolicies, holidays] = await Promise.all([
    getWeekendPolicies(),
    getHolidaysInRange(startDate, endDate),
  ]);
  const holidayDates = new Set(holidays.map((h) => toDateKey(h.holidayDate)));

  const allDates = [...eachDate(startDate, endDate)];
  const isHoliday = (date) => holidayDates.has(toDateKey(date));
  const isWeekend = (date) => isWeekendDate(date, weekendPolicies);
  const isRealWorkingDay = (date) => !isWeekend(date) && !isHoliday(date);

  const isSandwichedWeekend = (index) => {
    if (!applySandwichRule || isHoliday(allDates[index]) || !isWeekend(allDates[index])) return false;
    const hasWorkingDayBefore = allDates.slice(0, index).some(isRealWorkingDay);
    const hasWorkingDayAfter = allDates.slice(index + 1).some(isRealWorkingDay);
    return hasWorkingDayBefore && hasWorkingDayAfter;
  };

  const workingDates = allDates.filter((date, index) => {
    if (isHoliday(date)) return false;
    if (isWeekend(date)) return isSandwichedWeekend(index);
    return true;
  });

  if (workingDates.length === 0) {
    throw ApiError.badRequest("The selected dates fall entirely on weekends or holidays.");
  }

  if (isHalfDay) {
    return { totalDays: 0.5, workingDates };
  }

  return { totalDays: workingDates.length, workingDates };
};

// Builds the data a calendar UI needs for a given month: which dates are
// weekends, which are holidays, and (optionally) a set of leave date ranges
// to overlay on top.
const getMonthCalendarData = async (year, month) => {
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0));

  const [weekendPolicies, holidays] = await Promise.all([
    getWeekendPolicies(),
    getHolidaysInRange(startDate, endDate),
  ]);

  const weekendDates = [];
  for (const date of eachDate(startDate, endDate)) {
    if (isWeekendDate(date, weekendPolicies)) {
      weekendDates.push(toDateKey(date));
    }
  }

  return {
    weekendDates,
    holidays: holidays.map((h) => ({
      date: toDateKey(h.holidayDate),
      name: h.holidayName,
      isOptional: h.isOptional,
    })),
  };
};

// Total working days (excludes weekends + holidays) in a given month -
// used as the day-rate divisor for Loss-of-Pay payroll deductions.
const getWorkingDaysInMonth = async (year, month) => {
  const { weekendDates, holidays } = await getMonthCalendarData(year, month);
  const excludedDates = new Set([...weekendDates, ...holidays.map((h) => h.date)]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return daysInMonth - excludedDates.size;
};

module.exports = {
  computeWorkingDays,
  getMonthCalendarData,
  getWorkingDaysInMonth,
  toDateKey,
  eachDate,
  isWeekendDate,
  getWeekendPolicies,
  getHolidaysInRange,
};
