const cron = require("node-cron");
const prisma = require("../config/prisma");
const notificationService = require("../services/notification.service");
const { sendAnniversaryEmployeeEmail, sendAnniversaryManagerNoticeEmail } = require("../utils/email.util");

const IST_TIMEZONE = "Asia/Kolkata";

const getIstNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));

const getYearsCompleted = (joiningDate, now) => {
  const start = new Date(joiningDate);
  let years = now.getFullYear() - start.getFullYear();
  const hasHadAnniversaryThisYear =
    now.getMonth() > start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!hasHadAnniversaryThisYear) years -= 1;
  return years;
};

// Core check, separated from the cron registration so it can also be run
// on-demand for testing without waiting for the actual schedule - same
// pattern as birthday.job.js.
const runAnniversaryCheck = async () => {
  const istNow = getIstNow();
  const todayMonth = istNow.getMonth() + 1;
  const todayDay = istNow.getDate();
  const todayYear = istNow.getFullYear();

  const candidates = await prisma.user.findMany({
    where: { status: "ACTIVE", joiningDate: { not: null } },
    select: { id: true, firstName: true, lastName: true, email: true, joiningDate: true, managerId: true },
  });

  // joiningDate is stored as a plain calendar date (midnight UTC of the day
  // entered), so UTC getters give back exactly the month/day picked - no
  // timezone drift. years > 0 excludes someone who joined today (0 years).
  const todaysAnniversaries = candidates.filter((user) => {
    const years = getYearsCompleted(user.joiningDate, istNow);
    return years > 0 && user.joiningDate.getUTCMonth() + 1 === todayMonth && user.joiningDate.getUTCDate() === todayDay;
  });

  for (const user of todaysAnniversaries) {
    // Dedup against the Notification table itself (has an ANNIVERSARY
    // notification already gone out to this user this calendar year)
    // rather than a stored "last notified year" column - avoids adding a
    // tracking field just for this, and can't drift from what was
    // actually sent.
    let alreadyNotified;
    try {
      alreadyNotified = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type: notificationService.NOTIFICATION_TYPES.ANNIVERSARY,
          createdAt: { gte: new Date(Date.UTC(todayYear, 0, 1)) },
        },
      });
    } catch (err) {
      console.error(`Failed to check existing anniversary notification for user ${user.id}:`, err);
      continue;
    }
    if (alreadyNotified) continue;

    const years = getYearsCompleted(user.joiningDate, istNow);
    const employeeName = `${user.firstName} ${user.lastName}`;
    const yearWord = years === 1 ? "1 year" : `${years} years`;

    let manager = null;
    if (user.managerId) {
      try {
        manager = await prisma.user.findFirst({ where: { id: user.managerId, status: "ACTIVE" } });
      } catch (err) {
        console.error(`Failed to look up manager for anniversary of user ${user.id}:`, err);
      }
    }

    // Email and notification are independent concerns, each with its own
    // try/catch - a failure in one must never prevent the other from
    // running (an earlier version of birthday.job.js had this bug, where a
    // failed email silently skipped the notification too).
    try {
      await sendAnniversaryEmployeeEmail({ to: user.email, firstName: user.firstName, years });
      if (manager) {
        await sendAnniversaryManagerNoticeEmail({
          to: manager.email,
          managerFirstName: manager.firstName,
          employeeName,
          years,
        });
      }
    } catch (err) {
      console.error(`Failed to send anniversary email for user ${user.id}:`, err);
    }

    try {
      const recipientIds = new Set([user.id]);
      if (manager) recipientIds.add(manager.id);

      const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
      admins.forEach((admin) => recipientIds.add(admin.id));

      for (const recipientId of recipientIds) {
        const isSelf = recipientId === user.id;
        await notificationService.notify({
          userId: recipientId,
          type: notificationService.NOTIFICATION_TYPES.ANNIVERSARY,
          title: isSelf ? "Happy work anniversary!" : "Work anniversary today",
          message: isSelf
            ? `Congratulations on completing ${yearWord} with us!`
            : `${employeeName} is completing ${yearWord} with us today!`,
        });
      }
    } catch (err) {
      console.error(`Failed to create anniversary notification for user ${user.id}:`, err);
    }
  }

  return { checkedCount: candidates.length, sentCount: todaysAnniversaries.length };
};

// Registers the daily schedule - call once at server startup. Runs at
// 00:05 IST (just after the birthday check) regardless of the host
// machine's own timezone.
const startAnniversaryCronJob = () => {
  cron.schedule(
    "5 0 * * *",
    () => {
      runAnniversaryCheck().catch((err) => console.error("Anniversary check job failed:", err));
    },
    { timezone: IST_TIMEZONE }
  );
};

module.exports = { runAnniversaryCheck, startAnniversaryCronJob };
