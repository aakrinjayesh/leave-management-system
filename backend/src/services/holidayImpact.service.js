const prisma = require("../config/prisma");
const leaveCalendarService = require("./leaveCalendar.service");
const leaveBalanceService = require("./leaveBalance.service");
const companySettingsService = require("./companySettings.service");
const notificationService = require("./notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

const { toDateKey, eachDate } = leaveCalendarService;
const startOfUtcDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const round2 = (n) => Math.round(n * 100) / 100;

const rangeText = (start, end) => `${formatDateShort(start)} - ${formatDateShort(end)}`;
const appendRemark = (existing, note) => (existing ? `${existing} · ${note}` : note);

const notify = async (userId, title, message) => {
  try {
    await notificationService.notify({
      userId,
      type: notificationService.NOTIFICATION_TYPES.LEAVE_DECIDED,
      title,
      message,
    });
  } catch (err) {
    console.error("holidayImpact notify failed:", err);
  }
};

// After new holiday date(s) are created, fix up any APPROVED leave / WFH that
// now overlaps a holiday (PENDING requests are left alone - the approver will
// see the conflict):
//   - Leave: recompute totalDays excluding weekends + holidays. Drops to 0 ->
//     the whole request is CANCELLED and fully refunded. Otherwise totalDays
//     is reduced and the difference refunded to the balance.
//   - WFH: only CANCELLED when its ENTIRE range is now weekend/holiday.
// Cancelled/adjusted rows stay in the employee's history. Best-effort - never
// throws (called after the holiday-create HTTP response).
const reconcileApprovedTimeOffForHolidays = async (holidayDates) => {
  const keys = new Set(holidayDates.map(toDateKey));
  if (keys.size === 0) return;

  const minDate = holidayDates.reduce((a, b) => (a < b ? a : b));
  const maxDate = holidayDates.reduce((a, b) => (a > b ? a : b));
  const containsNewHoliday = (start, end) =>
    [...eachDate(start, end)].some((d) => keys.has(toDateKey(d)));

  try {
    // ---------------- leave ----------------
    const leaves = await prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: maxDate }, endDate: { gte: minDate } },
      include: { leavePolicy: true, user: { select: { id: true } } },
    });

    for (const leave of leaves) {
      if (!containsNewHoliday(leave.startDate, leave.endDate)) continue;

      let newTotalDays = 0;
      try {
        const res = await leaveCalendarService.computeWorkingDays({
          startDate: startOfUtcDay(leave.startDate),
          endDate: startOfUtcDay(leave.endDate),
          isHalfDay: leave.totalDays === 0.5,
          applySandwichRule: leave.weekendsCountAsLeave,
        });
        newTotalDays = res.totalDays;
      } catch {
        newTotalDays = 0; // whole range is weekend/holiday now
      }

      const delta = round2(leave.totalDays - newTotalDays);
      if (delta <= 0) continue;

      if (!leave.leavePolicy.isUnlimited) {
        const fy = await companySettingsService.getFiscalYearForDate(leave.startDate);
        const balance = await leaveBalanceService.getOrCreateBalance(leave.userId, leave.leavePolicy, fy);
        await leaveBalanceService.applyUsage(balance.id, -delta); // refund
      }

      if (newTotalDays <= 0) {
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { status: "CANCELLED", managerRemarks: "Auto-cancelled: these dates are now company holidays." },
        });
        await notify(
          leave.userId,
          "Leave cancelled",
          `Your ${leave.leavePolicy.leaveName} (${rangeText(leave.startDate, leave.endDate)}) was cancelled - those dates are now company holidays. ${delta} day(s) refunded.`
        );
      } else {
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: {
            totalDays: newTotalDays,
            managerRemarks: appendRemark(
              leave.managerRemarks,
              `Adjusted: ${delta} day(s) refunded - now a company holiday.`
            ),
          },
        });
        await notify(
          leave.userId,
          "Leave adjusted",
          `Your ${leave.leavePolicy.leaveName} (${rangeText(leave.startDate, leave.endDate)}) was adjusted - ${delta} day(s) refunded because those dates are now company holidays.`
        );
      }
    }

    // ---------------- wfh ----------------
    const wfhReqs = await prisma.wfhRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: maxDate }, endDate: { gte: minDate } },
      select: { id: true, userId: true, startDate: true, endDate: true },
    });
    const weekendPolicies = await leaveCalendarService.getWeekendPolicies();

    for (const w of wfhReqs) {
      if (!containsNewHoliday(w.startDate, w.endDate)) continue;

      const holsInRange = await leaveCalendarService.getHolidaysInRange(w.startDate, w.endDate);
      const holidaySet = new Set(holsInRange.map((h) => toDateKey(h.holidayDate)));
      const hasWorkingDay = [...eachDate(w.startDate, w.endDate)].some(
        (d) => !leaveCalendarService.isWeekendDate(d, weekendPolicies) && !holidaySet.has(toDateKey(d))
      );
      if (hasWorkingDay) continue;

      await prisma.wfhRequest.update({
        where: { id: w.id },
        data: { status: "CANCELLED", adminRemarks: "Auto-cancelled: these dates are now company holidays." },
      });
      await notify(
        w.userId,
        "WFH request cancelled",
        `Your approved WFH request (${rangeText(w.startDate, w.endDate)}) was cancelled - those dates are now company holidays.`
      );
    }
  } catch (err) {
    console.error("Failed to reconcile time-off after holiday creation:", err);
  }
};

module.exports = { reconcileApprovedTimeOffForHolidays };
