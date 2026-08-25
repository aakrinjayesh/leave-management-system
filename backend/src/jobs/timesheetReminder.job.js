const cron = require("node-cron");
const prisma = require("../config/prisma");
const timesheetService = require("../services/timesheet.service");
const notificationService = require("../services/notification.service");

const IST_TIMEZONE = "Asia/Kolkata";

const getIstNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));

// Every Monday-Sunday week whose Monday actually falls inside
// [monthStart, monthEnd] - a week that starts in the previous month (e.g.
// the 1st is a Wednesday) doesn't count as one of "this month's" weeks.
const getWeeksInMonth = (monthStart, monthEnd) => {
  const weeks = [];
  let weekStart = timesheetService.getWeekStart(monthStart);
  if (weekStart < monthStart) {
    weekStart = new Date(weekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  }
  while (weekStart <= monthEnd) {
    weeks.push(weekStart);
    weekStart = new Date(weekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() + 7);
  }
  return weeks;
};

// Core check, separated from the cron registration so it can also be run
// on-demand (see scripts/runTimesheetReminderCheck.js) for testing without
// waiting for the actual daily schedule. Only Client Projects
// (project.projectType === "ASSIGNED") require this - Internal Projects are
// exempt, per how the company actually wants timesheets tracked.
//
// Runs once a day. Does nothing until the month's last 7 calendar days begin
// (a plain day-count rather than picking a specific Mon-Sun week, since week
// boundaries don't line up cleanly with every month - some months split into
// 4 partial weeks, some into 5). Once in that window, every EARLIER week of
// the same month that's still missing a timesheet gets a fresh reminder each
// day this runs, for as long as it stays missing. It stops on its own once
// either the employee submits (next day's check finds no gap) or the month
// rolls over (the new month has no earlier weeks yet to be missing).
const runTimesheetLastWeekCheck = async (today = getIstNow()) => {
  const todayStart = timesheetService.startOfUtcDay(today);
  const monthStart = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(todayStart.getUTCFullYear(), todayStart.getUTCMonth() + 1, 0));
  const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const daysRemainingInMonth = Math.round((monthEnd - todayStart) / 86400000);
  if (daysRemainingInMonth > 6) {
    return { checkedCount: 0, remindedCount: 0 };
  }

  // Every week of this month that's already fully behind us - today's own
  // still-in-progress week is never counted as "overdue" yet.
  const weeksInMonth = getWeeksInMonth(monthStart, monthEnd);
  const currentWeekStart = timesheetService.getWeekStart(todayStart);
  const earlierWeeks = weeksInMonth.filter((weekStart) => weekStart < currentWeekStart);

  if (earlierWeeks.length === 0) {
    return { checkedCount: 0, remindedCount: 0 };
  }

  // Only currently-active memberships on currently-known Client Projects -
  // same scope the rest of the app (e.g. the admin Report page) already
  // uses, since membership removals aren't kept as history.
  const memberships = await prisma.projectMembership.findMany({
    where: { project: { projectType: "ASSIGNED" } },
    include: {
      user: { select: { id: true, status: true } },
      project: { select: { id: true, name: true, endDate: true } },
    },
  });

  let remindedCount = 0;

  for (const membership of memberships) {
    if (membership.user.status !== "ACTIVE") continue;

    // Never expect a submission for a week before they joined this project,
    // or after the project's own end date (if it has one).
    const membershipWeekStart = timesheetService.getWeekStart(membership.assignedAt);
    const applicableWeeks = earlierWeeks.filter((weekStart) => {
      if (weekStart < membershipWeekStart) return false;
      if (membership.project.endDate && weekStart > membership.project.endDate) return false;
      return true;
    });
    if (applicableWeeks.length === 0) continue;

    const submissions = await prisma.timesheetSubmission.findMany({
      where: {
        userId: membership.userId,
        projectId: membership.projectId,
        weekStartDate: { in: applicableWeeks },
      },
      select: { weekStartDate: true },
    });
    // Any submission at all counts as "not missing," even a rejected one -
    // resubmission nudges for those are already handled by the separate
    // TIMESHEET_DECIDED notification, not this one.
    const submittedWeekKeys = new Set(submissions.map((s) => s.weekStartDate.toISOString()));
    const missingWeeks = applicableWeeks.filter((weekStart) => !submittedWeekKeys.has(weekStart.toISOString()));
    if (missingWeeks.length === 0) continue;

    try {
      await notificationService.notify({
        userId: membership.userId,
        type: notificationService.NOTIFICATION_TYPES.TIMESHEET_MONTH_END_REMINDER,
        title: "Timesheet not submitted",
        message: `It's the last week of ${monthLabel} and you still haven't submitted your ${
          membership.project.name
        } timesheet for ${missingWeeks.length} earlier week${
          missingWeeks.length !== 1 ? "s" : ""
        } this month. Please update your timesheet before the month ends.`,
      });
      remindedCount += 1;
    } catch (err) {
      console.error(`Failed to send timesheet last-week reminder to user ${membership.userId}:`, err);
    }
  }

  return { checkedCount: memberships.length, remindedCount };
};

// Registers the daily schedule - call once at server startup. Runs at 9am
// IST every day; the check itself is a no-op until the month's last week
// actually begins.
const startTimesheetReminderCronJob = () => {
  cron.schedule(
    "0 9 * * *",
    () => {
      runTimesheetLastWeekCheck().catch((err) => console.error("Timesheet last-week check job failed:", err));
    },
    { timezone: IST_TIMEZONE }
  );
};

module.exports = { runTimesheetLastWeekCheck, startTimesheetReminderCronJob };
