const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const leaveCalendarService = require("./leaveCalendar.service");
const companySettingsService = require("./companySettings.service");
const { getFiscalYear } = require("../utils/fiscalYear.util");

const PAYSLIP_LINE_FIELDS = [
  "basic",
  "hra",
  "lta",
  "conveyance",
  "guaranteedAllowance",
  "specialAllowance",
  "annualBonusPay",
  "pfEmployee",
  "pfEmployer",
  "professionalTax",
  "tds",
  "lopAmount",
  "grossPay",
  "grossDeductions",
  "netPay",
];

const DEFAULT_CONFIG = {
  basicPercentOfCtc: 40,
  hraPercentOfBasic: 50,
  ltaPercentOfBasic: 8.33,
  guaranteedAllowancePercentOfBasic: 10,
  conveyanceMonthly: 1600,
  pfMonthlyAmount: 1800,
  professionalTax: 200,
  professionalTaxThreshold: 25000,
};

const getSalaryStructureConfig = async () => {
  const config = await prisma.salaryStructureConfig.findFirst();
  return config || DEFAULT_CONFIG;
};

const updateSalaryStructureConfig = async (data) => {
  const existing = await prisma.salaryStructureConfig.findFirst();
  if (existing) {
    return prisma.salaryStructureConfig.update({ where: { id: existing.id }, data });
  }
  return prisma.salaryStructureConfig.create({ data });
};

// Derives the monthly earnings breakdown from annual CTC using the
// admin-configured percentages. Special Allowance absorbs whatever's left so
// (basic + hra + lta + conveyance + guaranteedAllowance + specialAllowance +
// pfEmployer) always equals CTC / 12. PF is a flat amount - same for every
// employee, regardless of their actual Basic (matches the common practice of
// capping PF at the EPFO statutory wage ceiling). Professional Tax only
// applies once gross monthly pay reaches the configured threshold.
const computeSalaryBreakdown = (ctc, config) => {
  const monthlyCtc = ctc / 12;
  const basic = monthlyCtc * (config.basicPercentOfCtc / 100);
  const hra = basic * (config.hraPercentOfBasic / 100);
  const lta = basic * (config.ltaPercentOfBasic / 100);
  const guaranteedAllowance = basic * (config.guaranteedAllowancePercentOfBasic / 100);
  const conveyance = config.conveyanceMonthly;
  const pfEmployee = config.pfMonthlyAmount;
  const pfEmployer = config.pfMonthlyAmount;
  const specialAllowance = monthlyCtc - (basic + hra + lta + guaranteedAllowance + conveyance + pfEmployer);

  if (specialAllowance < 0) {
    throw ApiError.badRequest(
      "The Salary Structure percentages add up to more than the monthly CTC - please review Salary Structure settings."
    );
  }

  const grossMonthlyPay = basic + hra + lta + conveyance + specialAllowance + guaranteedAllowance;
  const professionalTax = grossMonthlyPay >= config.professionalTaxThreshold ? config.professionalTax : 0;

  return {
    basic,
    hra,
    lta,
    conveyance,
    guaranteedAllowance,
    specialAllowance,
    pfEmployee,
    pfEmployer,
    professionalTax,
  };
};

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const toDateKey = (date) => date.toISOString().slice(0, 10);

// Counts working days (excluding weekends/holidays) that an approved
// Loss-of-Pay request actually spends inside the target month, clipping the
// request's date range to the month's bounds first.
const countLopDaysInMonth = async (lopRequests, year, month) => {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));
  const { weekendDates, holidays } = await leaveCalendarService.getMonthCalendarData(year, month);
  const excludedDates = new Set([...weekendDates, ...holidays.map((h) => h.date)]);

  let total = 0;
  for (const request of lopRequests) {
    const isHalfDay = request.totalDays === 0.5;
    const start = request.startDate < monthStart ? monthStart : startOfUtcDay(request.startDate);
    const end = request.endDate > monthEnd ? monthEnd : startOfUtcDay(request.endDate);

    const cursor = new Date(start);
    while (cursor <= end) {
      const key = toDateKey(cursor);
      if (!excludedDates.has(key)) {
        total += isHalfDay ? 0.5 : 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return total;
};

// Loss-of-Pay deduction for the month: (earnings excluding one-time bonus) /
// working days in the month * LOP days taken. Takes the month's working-day
// count (Standard Days) as a parameter so it's only computed once per payslip.
const computeLopDeduction = async (userId, year, month, monthlyEarningsExcludingBonus, standardDays) => {
  const lopPolicies = await prisma.leavePolicy.findMany({ where: { isUnpaid: true } });
  if (lopPolicies.length === 0) {
    return { lopDays: 0, lopAmount: 0 };
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  const lopRequests = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leavePolicyId: { in: lopPolicies.map((p) => p.id) },
      status: "APPROVED",
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
  });

  if (lopRequests.length === 0) {
    return { lopDays: 0, lopAmount: 0 };
  }

  const lopDays = await countLopDaysInMonth(lopRequests, year, month);
  const lopAmount = standardDays > 0 ? (monthlyEarningsExcludingBonus / standardDays) * lopDays : 0;

  return { lopDays, lopAmount };
};

// Computes a payslip's full figures without saving - used for the admin's
// preview before they fill in TDS/bonus and confirm.
const computePayslip = async (user, year, month, { tds = 0, annualBonusPay = 0 } = {}) => {
  if (!user.salaryCtc) {
    throw ApiError.badRequest("This employee doesn't have a Salary/CTC set yet - add it from their profile details first.");
  }

  if (user.joiningDate) {
    const joining = new Date(user.joiningDate);
    const joiningSeq = joining.getUTCFullYear() * 12 + (joining.getUTCMonth() + 1);
    const targetSeq = year * 12 + month;
    if (targetSeq < joiningSeq) {
      const joiningLabel = joining.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
      throw ApiError.badRequest(
        `${user.firstName} joined on ${joiningLabel} - a payslip can't be generated for a month before that.`
      );
    }
  }

  const config = await getSalaryStructureConfig();
  const breakdown = computeSalaryBreakdown(user.salaryCtc, config);
  const earningsExcludingBonus =
    breakdown.basic + breakdown.hra + breakdown.lta + breakdown.conveyance + breakdown.guaranteedAllowance + breakdown.specialAllowance;

  // Standard Days = the month's working days per the company calendar
  // (weekends/holidays excluded) - the "expected" days. Days Worked is that
  // same figure minus any approved Loss-of-Pay days - the "actual" days.
  const standardDays = await leaveCalendarService.getWorkingDaysInMonth(year, month);
  const { lopDays, lopAmount } = await computeLopDeduction(user.id, year, month, earningsExcludingBonus, standardDays);
  const daysWorked = standardDays - lopDays;

  const grossPay = earningsExcludingBonus + annualBonusPay;
  const grossDeductions = breakdown.pfEmployee + breakdown.professionalTax + tds + lopAmount;
  const netPay = grossPay - grossDeductions;

  return {
    ...breakdown,
    annualBonusPay,
    tds,
    lopDays,
    lopAmount,
    standardDays,
    daysWorked,
    grossPay,
    grossDeductions,
    netPay,
  };
};

const generatePayslip = async (userId, year, month, { tds = 0, annualBonusPay = 0 }, generatedById) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  const computed = await computePayslip(user, year, month, { tds, annualBonusPay });

  return prisma.payslip.upsert({
    where: { userId_month_year: { userId, month, year } },
    update: { ...computed, generatedById },
    create: { userId, month, year, generatedById, ...computed },
  });
};

// Sums every stored payslip line from the start of the company's fiscal
// year through and including the target month, for the YTD columns on the PDF.
const getYtdTotals = async (userId, year, month) => {
  const settings = await companySettingsService.getSettings();
  const fiscalYearOf = (y, m) => getFiscalYear(new Date(Date.UTC(y, m - 1, 1)), settings.fiscalYearStartMonth);
  const targetFiscalYear = fiscalYearOf(year, month);
  const targetSeq = year * 12 + month;

  const payslips = await prisma.payslip.findMany({ where: { userId } });
  const relevant = payslips.filter((p) => fiscalYearOf(p.year, p.month) === targetFiscalYear && p.year * 12 + p.month <= targetSeq);

  return PAYSLIP_LINE_FIELDS.reduce((totals, field) => {
    totals[field] = relevant.reduce((sum, p) => sum + p[field], 0);
    return totals;
  }, {});
};

// Adds a freshly-computed (not-yet-saved) payslip's figures onto a YTD
// totals object - used to preview what YTD will look like once saved.
const addToYtdTotals = (ytd, computed) =>
  PAYSLIP_LINE_FIELDS.reduce((result, field) => {
    result[field] = (ytd[field] || 0) + (computed[field] || 0);
    return result;
  }, {});

module.exports = {
  getSalaryStructureConfig,
  updateSalaryStructureConfig,
  computePayslip,
  generatePayslip,
  getYtdTotals,
  addToYtdTotals,
  DEFAULT_CONFIG,
};
