const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const leaveCalendarService = require("./leaveCalendar.service");

// Days an employee is NOT allowed to log timesheet hours on (or only partly):
//   WEEKEND    - per the company weekend policy
//   HOLIDAY    - a company holiday
//   FULL_LEAVE - the employee has an approved full-day leave that day
//   HALF_LEAVE - approved half-day leave: hours allowed but capped at maxHours
// Returned as Map<"YYYY-MM-DD", { type, maxHours }> holding only restricted days.

const round2 = (n) => Math.round(n * 100) / 100;

const getBlockedDays = async ({ userId, start, end, hoursPerDay = 8 }) => {
  const [weekendPolicies, holidays, leaveRequests] = await Promise.all([
    leaveCalendarService.getWeekendPolicies(),
    leaveCalendarService.getHolidaysInRange(start, end),
    prisma.leaveRequest.findMany({
      where: { userId, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
      select: { startDate: true, endDate: true, totalDays: true },
    }),
  ]);

  const holidaySet = new Set(holidays.map((h) => leaveCalendarService.toDateKey(h.holidayDate)));
  const halfDayHours = round2(hoursPerDay / 2);

  const blocked = new Map();

  for (const date of leaveCalendarService.eachDate(start, end)) {
    const key = leaveCalendarService.toDateKey(date);
    if (leaveCalendarService.isWeekendDate(date, weekendPolicies)) {
      blocked.set(key, { type: "WEEKEND", maxHours: 0 });
    } else if (holidaySet.has(key)) {
      blocked.set(key, { type: "HOLIDAY", maxHours: 0 });
    }
  }

  // Leave wins over a weekend/holiday label if they somehow overlap, but a
  // weekend/holiday already blocks the day so it barely matters.
  for (const req of leaveRequests) {
    const isSingleDayHalf = req.totalDays === 0.5 && leaveCalendarService.toDateKey(req.startDate) === leaveCalendarService.toDateKey(req.endDate);
    for (const date of leaveCalendarService.eachDate(req.startDate, req.endDate)) {
      const key = leaveCalendarService.toDateKey(date);
      if (date < start || date > end) continue;
      if (isSingleDayHalf) {
        blocked.set(key, { type: "HALF_LEAVE", maxHours: halfDayHours });
      } else {
        blocked.set(key, { type: "FULL_LEAVE", maxHours: 0 });
      }
    }
  }

  return blocked;
};

const REASON_TEXT = {
  WEEKEND: "a weekend",
  HOLIDAY: "a company holiday",
  FULL_LEAVE: "an approved leave day",
};

// Throws if `hoursWorked` on `dateKey` breaks a constraint. `subject` reads
// into the message ("you" for the employee's own path, or the employee's
// first name when a manager/admin logs on their behalf).
const assertHoursAllowed = (blocked, dateKey, hoursWorked, subject = "you") => {
  const c = blocked.get(dateKey);
  if (!c) return;

  if (c.type === "HALF_LEAVE") {
    if (hoursWorked > c.maxHours) {
      throw ApiError.badRequest(`${dateKey} is a half-day leave for ${subject} - at most ${c.maxHours}h can be logged.`);
    }
    return;
  }

  if (hoursWorked > 0) {
    const forWhom = subject === "you" ? "" : ` for ${subject}`;
    throw ApiError.badRequest(`${dateKey} is ${REASON_TEXT[c.type]}${forWhom} - hours can't be logged on it.`);
  }
};

// Validates a whole set of {date, hoursWorked} rows at once.
const assertEntriesAllowed = (blocked, rows, subject = "you") => {
  for (const row of rows) {
    const key = typeof row.date === "string" ? row.date.slice(0, 10) : leaveCalendarService.toDateKey(new Date(row.date));
    assertHoursAllowed(blocked, key, Number(row.hoursWorked) || 0, subject);
  }
};

// Plain object for API responses (Maps don't serialise).
const toConstraintMap = (blocked) => Object.fromEntries(blocked);

// "worked days / working days" for a period. Working days = every day that
// isn't a weekend / holiday / full-day leave (a half-day leave counts as 0.5).
// Worked days = those days that have at least one hour logged (again 0.5 for a
// half-day-leave day). `entries` is whatever entry set the caller already has
// (draft+submitted for the employee's own view, submitted-only for a
// manager/admin view).
const summarisePeriod = (blocked, entries, start, end) => {
  const hoursByDate = new Map();
  for (const e of entries) {
    const key = leaveCalendarService.toDateKey(new Date(e.date));
    hoursByDate.set(key, (hoursByDate.get(key) || 0) + e.hoursWorked);
  }

  let workingDays = 0;
  let workedDays = 0;
  for (const date of leaveCalendarService.eachDate(start, end)) {
    const key = leaveCalendarService.toDateKey(date);
    const c = blocked.get(key);
    if (c && c.type !== "HALF_LEAVE") continue; // weekend / holiday / full leave
    const weight = c && c.type === "HALF_LEAVE" ? 0.5 : 1;
    workingDays += weight;
    if ((hoursByDate.get(key) || 0) > 0) workedDays += weight;
  }

  return { workingDays: round2(workingDays), workedDays: round2(workedDays) };
};

module.exports = {
  getBlockedDays,
  assertHoursAllowed,
  assertEntriesAllowed,
  toConstraintMap,
  summarisePeriod,
};
