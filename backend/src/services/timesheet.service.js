const prisma = require("../config/prisma");
const { buildCsv, slugify } = require("../utils/csv.util");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Monday of the week containing `date` (Monday-Sunday weeks).
const getWeekStart = (date) => {
  const day = startOfUtcDay(date);
  const dayOfWeek = day.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(day);
  monday.setUTCDate(monday.getUTCDate() + diffToMonday);
  return monday;
};

const getWeekEnd = (weekStart) => {
  const sunday = new Date(weekStart);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return sunday;
};

// Computes the [start, end] date range a manager/admin view request is
// asking about, given a view mode (day/week/month) and an anchor date.
const getViewRange = (view, anchorDate) => {
  const anchor = startOfUtcDay(anchorDate);

  if (view === "day") {
    return { start: anchor, end: anchor };
  }

  if (view === "month") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // default: week
  const start = getWeekStart(anchor);
  const end = getWeekEnd(start);
  return { start, end };
};

// Submitted (locked) entries only - draft/in-progress entries aren't visible
// to a manager or admin until the employee submits the week.
const getSubmittedEntriesInRange = (userId, start, end) =>
  prisma.timesheetEntry.findMany({
    where: {
      userId,
      timesheetSubmissionId: { not: null },
      date: { gte: start, lte: end },
    },
    orderBy: { date: "asc" },
  });

const sumHours = (entries) => entries.reduce((sum, entry) => sum + entry.hoursWorked, 0);

const toDateKey = (date) => new Date(date).toISOString().slice(0, 10);

// Detailed per-employee CSV: one row per entry plus a totals row - exactly
// the same data shown on the day/week/month breakdown screen.
const buildEmployeeTimesheetCsv = ({ employee, view, rangeStart, rangeEnd, entries, totalHours }) => {
  const rows = entries.map((entry) => [toDateKey(entry.date), entry.hoursWorked, entry.description]);
  rows.push(["Total", totalHours, ""]);

  const csv = buildCsv(["Date", "Hours", "Description"], rows);
  const filename = `${slugify(`${employee.firstName}-${employee.lastName}`)}-timesheet-${view}-${toDateKey(rangeStart)}-to-${toDateKey(rangeEnd)}.csv`;

  return { csv, filename };
};

// Company-wide payroll CSV: one row per active non-admin employee with their
// total submitted hours for the given month.
const buildPayrollCsv = async (monthStart, monthEnd) => {
  const employees = await prisma.user.findMany({
    where: { status: "ACTIVE", userType: { in: ["EMPLOYEE", "MANAGER"] } },
    orderBy: { firstName: "asc" },
  });

  const rows = [];
  let grandTotal = 0;

  for (const employee of employees) {
    const entries = await getSubmittedEntriesInRange(employee.id, monthStart, monthEnd);
    const total = sumHours(entries);
    grandTotal += total;
    rows.push([`${employee.firstName} ${employee.lastName}`, employee.email, total]);
  }

  rows.push(["Total", "", grandTotal]);

  const csv = buildCsv(["Employee Name", "Email", "Total Hours"], rows);
  const monthLabel = toDateKey(monthStart).slice(0, 7);
  const filename = `payroll-timesheet-${monthLabel}.csv`;

  return { csv, filename };
};

module.exports = {
  startOfUtcDay,
  getWeekStart,
  getWeekEnd,
  getViewRange,
  getSubmittedEntriesInRange,
  sumHours,
  buildEmployeeTimesheetCsv,
  buildPayrollCsv,
};
