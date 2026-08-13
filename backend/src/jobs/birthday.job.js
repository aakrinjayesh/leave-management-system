const cron = require("node-cron");
const prisma = require("../config/prisma");
const {
  sendBirthdayEmployeeEmail,
  sendBirthdayManagerNoticeEmail,
  sendAdminBirthdayBroadcastEmail,
} = require("../utils/email.util");
const notificationService = require("../services/notification.service");

const IST_TIMEZONE = "Asia/Kolkata";

const getIstNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: IST_TIMEZONE }));

// Core check, separated from the cron registration so it can also be run
// on-demand (see scripts/runBirthdayCheck.js) for testing without waiting
// for the actual schedule.
const runBirthdayCheck = async () => {
  const istNow = getIstNow();
  const todayMonth = istNow.getMonth() + 1;
  const todayDay = istNow.getDate();
  const todayYear = istNow.getFullYear();

  const candidates = await prisma.user.findMany({
    where: { status: "ACTIVE", birthDate: { not: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      birthDate: true,
      managerId: true,
      userType: true,
      lastBirthdayEmailYear: true,
    },
  });

  // birthDate is stored as a plain calendar date (midnight UTC of the day
  // entered), so UTC getters give back exactly the month/day the employee
  // picked - no timezone drift.
  const todaysBirthdays = candidates.filter(
    (user) =>
      user.lastBirthdayEmailYear !== todayYear &&
      user.birthDate.getUTCMonth() + 1 === todayMonth &&
      user.birthDate.getUTCDate() === todayDay
  );

  for (const user of todaysBirthdays) {
    // Email and notification are independent concerns, each with its own
    // try/catch - a failure in one must never prevent the other from
    // running (an earlier version nested them under one try, which meant an
    // email failure silently skipped the notification too).
    try {
      await sendBirthdayEmployeeEmail({ to: user.email, firstName: user.firstName });

      if (user.userType === "ADMIN") {
        // Admins typically have no manager to notify - broadcast to everyone
        // else in the system instead.
        const everyoneElse = await prisma.user.findMany({
          where: { status: "ACTIVE", id: { not: user.id } },
          select: { email: true, firstName: true },
        });

        for (const recipient of everyoneElse) {
          await sendAdminBirthdayBroadcastEmail({
            to: recipient.email,
            recipientFirstName: recipient.firstName,
            adminName: `${user.firstName} ${user.lastName}`,
          });
        }
      } else if (user.managerId) {
        const manager = await prisma.user.findFirst({ where: { id: user.managerId, status: "ACTIVE" } });
        if (manager) {
          await sendBirthdayManagerNoticeEmail({
            to: manager.email,
            managerFirstName: manager.firstName,
            employeeName: `${user.firstName} ${user.lastName}`,
          });
        }
      }
    } catch (err) {
      console.error(`Failed to send birthday email for user ${user.id}:`, err);
    }

    // In-app notification broadcast: unlike the email above (targeted at
    // just the birthday person's manager, or everyone only if they're an
    // admin), every active account gets notified regardless of role.
    try {
      const everyoneElse = await prisma.user.findMany({
        where: { status: "ACTIVE", id: { not: user.id } },
        select: { id: true },
      });
      const employeeName = `${user.firstName} ${user.lastName}`;

      await notificationService.notify({
        userId: user.id,
        type: notificationService.NOTIFICATION_TYPES.BIRTHDAY,
        title: "Happy Birthday!",
        message: "Wishing you a very happy birthday! Have a great day.",
      });
      await notificationService.notifyMany(
        everyoneElse.map((u) => u.id),
        {
          type: notificationService.NOTIFICATION_TYPES.BIRTHDAY,
          title: "Team birthday today",
          message: `Today is ${employeeName}'s birthday!`,
        }
      );
    } catch (err) {
      console.error(`Failed to create birthday notification for user ${user.id}:`, err);
    }

    try {
      await prisma.user.update({ where: { id: user.id }, data: { lastBirthdayEmailYear: todayYear } });
    } catch (err) {
      console.error(`Failed to record birthday email year for user ${user.id}:`, err);
    }
  }

  return { checkedCount: candidates.length, sentCount: todaysBirthdays.length };
};

// Registers the daily schedule - call once at server startup. Runs at
// midnight IST regardless of the host machine's own timezone.
const startBirthdayCronJob = () => {
  cron.schedule(
    "0 0 * * *",
    () => {
      runBirthdayCheck().catch((err) => console.error("Birthday check job failed:", err));
    },
    { timezone: IST_TIMEZONE }
  );
};

module.exports = { runBirthdayCheck, startBirthdayCronJob };
