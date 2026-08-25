// Manually runs the last-week timesheet check outside of its daily
// schedule - handy for testing without waiting for the actual last week of
// the month. Optionally pass a date to pretend "today" is that date instead
// (useful for testing against a month whose last week hasn't arrived yet).
// Usage: node scripts/runTimesheetReminderCheck.js [YYYY-MM-DD]
const { runTimesheetLastWeekCheck } = require("../src/jobs/timesheetReminder.job");
const prisma = require("../src/config/prisma");

const overrideDate = process.argv[2] ? new Date(process.argv[2]) : undefined;

runTimesheetLastWeekCheck(overrideDate)
  .then((result) => {
    console.log("Timesheet last-week check complete:", result);
  })
  .catch((err) => {
    console.error("Timesheet last-week check failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
