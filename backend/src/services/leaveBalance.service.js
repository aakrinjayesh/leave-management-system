const prisma = require("../config/prisma");
const companySettingsService = require("./companySettings.service");

// The {year, month} list this employee has been accruing leave for within
// the given fiscal year, as of `asOfDate` - starting from whichever is
// LATER: the fiscal year's start month, or the month they joined, through
// `asOfDate`'s month. Capped at 12 entries, since a fiscal year is never
// more than that regardless of how far past it `asOfDate` is (e.g. checking
// a long-completed past fiscal year).
const getAccrualMonths = (fiscalYear, fiscalYearStartMonth, joiningDate, asOfDate) => {
  const fyStartSeq = fiscalYear * 12 + fiscalYearStartMonth;
  const asOfSeq = asOfDate.getUTCFullYear() * 12 + (asOfDate.getUTCMonth() + 1);
  const joining = joiningDate ? new Date(joiningDate) : null;
  const joiningSeq = joining ? joining.getUTCFullYear() * 12 + (joining.getUTCMonth() + 1) : fyStartSeq;

  const startSeq = Math.max(fyStartSeq, joiningSeq);
  const endSeq = Math.min(startSeq + 11, asOfSeq);

  const months = [];
  for (let seq = startSeq; seq <= endSeq; seq++) {
    const year = Math.floor((seq - 1) / 12);
    const month = seq - year * 12;
    months.push({ year, month });
  }
  return months;
};

const getAccruedMonthsCount = (fiscalYear, fiscalYearStartMonth, joiningDate, asOfDate) =>
  getAccrualMonths(fiscalYear, fiscalYearStartMonth, joiningDate, asOfDate).length;

// How many days should be credited by now for an accrual policy - just
// monthlyAccrualDays x however many months have elapsed so far this fiscal
// year (see getAccruedMonthsCount).
const computeAccruedAllocation = async (leavePolicy, userId, fiscalYear) => {
  const [settings, user] = await Promise.all([
    companySettingsService.getSettings(),
    prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } }),
  ]);

  const months = getAccruedMonthsCount(fiscalYear, settings.fiscalYearStartMonth, user?.joiningDate, new Date());
  return months * leavePolicy.monthlyAccrualDays;
};

// Lazily creates (or tops up) an employee's balance for one leave policy in
// one fiscal year.
//
// Accrual policies (monthlyAccrualDays set) don't get the full year's
// allocation up front - they're credited a little each month, and whatever
// isn't used just sits in the same running balance (that's the entire
// "carry forward" mechanism: nothing resets between months, only at the
// next fiscal year, when a fresh balance row starts from 0). Since there's
// no scheduled job crediting this every month, this instead recomputes "how
// much SHOULD have accrued by now" on every call and tops the stored
// balance up to match if it's behind - so it's correct whether checked
// daily or once every few months, with no missed-run risk.
//
// Non-accrual policies (monthlyAccrualDays null, e.g. Unpaid Leave) keep
// the original behavior: the full year's allocatedLeaves, available
// immediately.
const getOrCreateBalance = async (userId, leavePolicy, year) => {
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_leavePolicyId_year: { userId, leavePolicyId: leavePolicy.id, year } },
  });

  if (leavePolicy.monthlyAccrualDays == null) {
    if (existing) return existing;
    return prisma.leaveBalance.create({
      data: {
        userId,
        leavePolicyId: leavePolicy.id,
        year,
        allocatedLeaves: leavePolicy.allocatedLeaves,
        usedLeaves: 0,
        remainingLeaves: leavePolicy.allocatedLeaves,
      },
    });
  }

  const accrued = await computeAccruedAllocation(leavePolicy, userId, year);

  if (!existing) {
    return prisma.leaveBalance.create({
      data: {
        userId,
        leavePolicyId: leavePolicy.id,
        year,
        allocatedLeaves: accrued,
        usedLeaves: 0,
        remainingLeaves: accrued,
      },
    });
  }

  if (accrued > existing.allocatedLeaves) {
    const topUp = accrued - existing.allocatedLeaves;
    return prisma.leaveBalance.update({
      where: { id: existing.id },
      data: {
        allocatedLeaves: { increment: topUp },
        remainingLeaves: { increment: topUp },
      },
    });
  }

  return existing;
};

const applyUsage = (balanceId, deltaDays) =>
  prisma.leaveBalance.update({
    where: { id: balanceId },
    data: {
      usedLeaves: { increment: deltaDays },
      remainingLeaves: { decrement: deltaDays },
    },
  });

// Splits a requested leave range into 1 or 2 pieces based on available
// balance. If the whole request fits, returns it unchanged under the
// original policy. If it doesn't, whatever's covered by the remaining
// balance stays under the original (paid) policy, and everything beyond
// that is re-pointed at the Unpaid Leave policy instead of being blocked
// outright - the employee's request still goes through, the excess just
// becomes a Loss-of-Pay day in payroll.
//
// Only ever splits on a whole working-day boundary, never mid-day: any
// fractional day of balance left over after covering as many whole days as
// possible is folded into the unpaid portion, since a single calendar day
// can't be half-paid/half-unpaid in this data model (one request = one
// policy, one isHalfDay flag for the whole thing).
const splitForOverage = ({ leavePolicy, unpaidPolicyId, remainingLeaves, workingDates, requestStart, requestEnd, isHalfDay, totalDays }) => {
  if (leavePolicy.isUnlimited || totalDays <= remainingLeaves) {
    return [{ leavePolicyId: leavePolicy.id, startDate: requestStart, endDate: requestEnd, totalDays }];
  }

  if (isHalfDay) {
    return [{ leavePolicyId: unpaidPolicyId, startDate: requestStart, endDate: requestEnd, totalDays }];
  }

  const paidWholeDays = Math.max(0, Math.min(workingDates.length, Math.floor(remainingLeaves)));

  if (paidWholeDays === 0) {
    return [{ leavePolicyId: unpaidPolicyId, startDate: requestStart, endDate: requestEnd, totalDays }];
  }

  return [
    {
      leavePolicyId: leavePolicy.id,
      startDate: requestStart,
      endDate: workingDates[paidWholeDays - 1],
      totalDays: paidWholeDays,
    },
    {
      leavePolicyId: unpaidPolicyId,
      startDate: workingDates[paidWholeDays],
      endDate: requestEnd,
      totalDays: workingDates.length - paidWholeDays,
    },
  ];
};

const listBalancesForUser = (userId, year) =>
  prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leavePolicy: true },
    orderBy: { leavePolicy: { leaveName: "asc" } },
  });

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Month-by-month Opening/Accrued/Availed/Adjustment/Closing balance for one
// accrual leave policy, computed fresh from the policy's monthly accrual
// rate and actual APPROVED leave history - not read off the LeaveBalance
// row, so it always reflects the clean accrual math regardless of whatever
// legacy lump-sum number that row might still be carrying for an employee
// who had a balance from before this policy became accrual-based.
// "Availed" for a request that spans a month boundary is attributed
// entirely to the month its start date falls in, not split day-by-day
// across months - a simplification, since the total across all months
// still always equals the true total used.
// Adjustment is always 0 - there's no manual balance-correction feature yet.
const getMonthlyLedger = async (userId, leavePolicy, fiscalYear) => {
  if (leavePolicy.monthlyAccrualDays == null) return [];

  const [settings, user, approvedRequests] = await Promise.all([
    companySettingsService.getSettings(),
    prisma.user.findUnique({ where: { id: userId }, select: { joiningDate: true } }),
    prisma.leaveRequest.findMany({
      where: { userId, leavePolicyId: leavePolicy.id, status: "APPROVED" },
      select: { startDate: true, totalDays: true },
    }),
  ]);

  const months = getAccrualMonths(fiscalYear, settings.fiscalYearStartMonth, user?.joiningDate, new Date());

  const availedByMonth = {};
  for (const request of approvedRequests) {
    const d = new Date(request.startDate);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;
    availedByMonth[key] = (availedByMonth[key] || 0) + request.totalDays;
  }

  let runningClosing = 0;
  return months.map(({ year, month }) => {
    const opening = runningClosing;
    const accrued = leavePolicy.monthlyAccrualDays;
    const availed = availedByMonth[`${year}-${month}`] || 0;
    const adjustment = 0;
    const closing = opening + accrued - availed + adjustment;
    runningClosing = closing;

    return { year, month, monthLabel: MONTH_NAMES[month - 1], opening, accrued, availed, adjustment, closing };
  });
};

// Ledgers for every active accrual policy this user has, keyed by
// leavePolicyId - the "monthly history" view for one employee, one fiscal
// year, across Sick/Casual/Earned Leave (or whatever else is accrual-based).
const getAllLedgersForUser = async (userId, fiscalYear) => {
  const policies = await prisma.leavePolicy.findMany({
    where: { isActive: true, monthlyAccrualDays: { not: null } },
    orderBy: { leaveName: "asc" },
  });

  const ledgers = await Promise.all(policies.map((policy) => getMonthlyLedger(userId, policy, fiscalYear)));

  return policies.map((policy, i) => ({
    leavePolicyId: policy.id,
    leaveName: policy.leaveName,
    months: ledgers[i],
  }));
};

module.exports = {
  getOrCreateBalance,
  applyUsage,
  listBalancesForUser,
  getAccruedMonthsCount,
  splitForOverage,
  getMonthlyLedger,
  getAllLedgersForUser,
};
