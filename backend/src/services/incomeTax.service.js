const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { TAX_REGIME } = require("../utils/constants");
const payrollService = require("./payroll.service");

// India's Income Tax financial year is always fixed April-March by law,
// independent of this company's own configurable fiscalYearStartMonth
// (which only governs leave-balance and payroll YTD bucketing - see
// companySettings.service.js). `financialYear` here is always the starting
// calendar year, e.g. 2025 means FY 2025-26 (April 2025 - March 2026).
const FINANCIAL_YEAR_START_MONTH = 4;

const monthsInFinancialYear = (financialYear) => {
  const months = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = FINANCIAL_YEAR_START_MONTH - 1 + i;
    const year = financialYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    months.push({ year, month });
  }
  return months;
};

// New Regime slabs (2025 revision) - confirmed against the company's own
// Accounts team reference. Old Regime slabs are the long-standing traditional
// ones, and additionally depend on age (see getOldRegimeSlabs below).
const NEW_REGIME_SLABS = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_SLABS_BELOW_60 = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_SLABS_SENIOR_60_TO_80 = [
  { upTo: 300000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const OLD_REGIME_SLABS_SUPER_SENIOR_ABOVE_80 = [
  { upTo: 500000, rate: 0 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: Infinity, rate: 0.3 },
];

const getOldRegimeSlabs = (age) => {
  if (age >= 80) return OLD_REGIME_SLABS_SUPER_SENIOR_ABOVE_80;
  if (age >= 60) return OLD_REGIME_SLABS_SENIOR_60_TO_80;
  return OLD_REGIME_SLABS_BELOW_60;
};

// Age is determined as on the last day of the financial year (31 March),
// same convention Indian income tax uses to decide senior/super-senior status.
const getAgeAsOfFinancialYearEnd = (birthDate, financialYear) => {
  const fyEnd = new Date(Date.UTC(financialYear + 1, 2, 31));
  const birth = new Date(birthDate);
  let age = fyEnd.getUTCFullYear() - birth.getUTCFullYear();
  const hasHadBirthdayByFyEnd =
    fyEnd.getUTCMonth() > birth.getUTCMonth() ||
    (fyEnd.getUTCMonth() === birth.getUTCMonth() && fyEnd.getUTCDate() >= birth.getUTCDate());
  if (!hasHadBirthdayByFyEnd) age -= 1;
  return age;
};

// Standard progressive slab breakdown - each slab's rate applies only to the
// slice of income that falls within it, not the whole income. Returns each
// slab's own slice and tax separately, for the line-by-line breakdown the
// official document format shows ("Tax on Rs. 4,00,000 @ 5%", etc.).
const computeSlabBreakdown = (taxableIncome, slabs) => {
  const breakdown = [];
  let previousLimit = 0;
  for (const slab of slabs) {
    if (taxableIncome <= previousLimit) break;
    const amountInSlab = Math.min(taxableIncome, slab.upTo) - previousLimit;
    breakdown.push({ from: previousLimit, to: Math.min(taxableIncome, slab.upTo), amountInSlab, rate: slab.rate, tax: amountInSlab * slab.rate });
    previousLimit = slab.upTo;
  }
  return breakdown;
};

const computeSlabTax = (taxableIncome, slabs) =>
  computeSlabBreakdown(taxableIncome, slabs).reduce((sum, slab) => sum + slab.tax, 0);

// Section 87A rebate: income up to the threshold owes zero tax. Simplified -
// real law also has "marginal relief" tapering just above the threshold so
// tax doesn't jump sharply; that tapering isn't modelled here, only the flat
// cutoff (New Regime: 12,00,000 / Old Regime: 5,00,000).
const applyRebate87A = (tax, totalIncome, regime) => {
  const threshold = regime === TAX_REGIME.NEW ? 1200000 : 500000;
  return totalIncome <= threshold ? 0 : tax;
};

// Least of: actual HRA received, rent paid minus 10% of Basic, or 50%/40% of
// Basic (metro/non-metro) - the standard Section 10(13A) formula. Old Regime
// only; New Regime has no HRA exemption at all.
const computeHraExemption = ({ basicAnnual, hraReceivedAnnual, rentPaidAnnual, isMetroCity }) => {
  if (!rentPaidAnnual) return 0;
  const rentMinusTenPercentBasic = Math.max(rentPaidAnnual - basicAnnual * 0.1, 0);
  const cityPercentOfBasic = basicAnnual * (isMetroCity ? 0.5 : 0.4);
  return Math.max(Math.min(hraReceivedAnnual, rentMinusTenPercentBasic, cityPercentOfBasic), 0);
};

// Statutory caps - Old Regime only. Section 80D's real cap varies further by
// whether the premium covers senior-citizen parents; simplified here to one
// combined cap rather than modelling every sub-limit.
const SECTION_80C_CAP = 150000;
const SECTION_80D_CAP = 100000;
const HOME_LOAN_INTEREST_CAP = 200000;

const roundToNearestTen = (value) => Math.round(value / 10) * 10;

const EARNING_FIELDS = ["basic", "hra", "lta", "conveyance", "guaranteedAllowance", "specialAllowance", "annualBonusPay"];

// Recurring monthly pay components - everything except the one-off bonus.
// Used to price a still-in-progress financial year at a single, current
// monthly rate (see getAnnualEarningsEstimate below).
const RECURRING_EARNING_FIELDS = EARNING_FIELDS.filter((field) => field !== "annualBonusPay");

const sumPayslips = (payslips) => {
  const totals = { tds: 0 };
  for (const field of EARNING_FIELDS) totals[field] = 0;
  for (const payslip of payslips) {
    for (const field of EARNING_FIELDS) totals[field] += payslip[field];
    totals.tds += payslip.tds;
  }
  return totals;
};

const totalGross = (totals) => EARNING_FIELDS.reduce((sum, field) => sum + (totals[field] || 0), 0);

const getPayslipsForFinancialYear = async (userId, financialYear) => {
  const rows = await prisma.payslip.findMany({
    where: { userId, year: { in: [financialYear, financialYear + 1] } },
  });
  const monthKeys = new Set(monthsInFinancialYear(financialYear).map(({ year, month }) => `${year}-${month}`));
  return rows.filter((payslip) => monthKeys.has(`${payslip.year}-${payslip.month}`));
};

// This financial year's months that this employee could possibly have a
// payslip for, given when they joined - all 12 for anyone who joined before
// the year started, fewer (starting partway through) for a mid-year joiner,
// empty for a financial year entirely before they joined. Used instead of a
// hardcoded 12 so a mid-year joiner's already-completed year is correctly
// treated as "Final" once their real (fewer than 12) months all exist,
// instead of forever looking "Projected" and being wrongly stretched across
// 12 months - and so the "current rate" reference month (below) is picked
// from months they could actually have been paid for, not the FY's first
// month regardless of whether they'd even joined yet.
const getEligibleMonthsInFinancialYear = (joiningDate, financialYear) => {
  const months = monthsInFinancialYear(financialYear);
  if (!joiningDate) return months;

  const joining = new Date(joiningDate);
  const joiningSeq = joining.getUTCFullYear() * 12 + (joining.getUTCMonth() + 1);

  return months.filter(({ year, month }) => year * 12 + month >= joiningSeq);
};

// Builds this financial year's annual recurring pay (Basic/HRA/LTA/
// Conveyance/Guaranteed Allowance/Special Allowance) by pricing EACH
// eligible month at whichever Salary Structure was actually effective for
// that specific month - regardless of whether a payslip was ever generated
// for it. A mid-year raise is naturally prorated: months before the raise
// price at the old rate, months from the raise's effective month onward
// price at the new rate - matching how income tax is genuinely calculated
// for a mid-year raise, and matching a single unchanged rate when there's
// no raise at all. Because this always re-derives from the Salary
// Structure History rather than trusting whatever's stored on an
// already-generated payslip, a payslip that was generated before a
// backdated raise was entered no longer produces a stale, pre-raise figure
// here either.
// Bonus and TDS already paid/withheld are real one-off events recorded on
// individual payslips, not part of the recurring structure, so those still
// come from whichever real payslips exist for this year.
const getAnnualEarningsEstimate = async (user, financialYear) => {
  const eligibleMonths = getEligibleMonthsInFinancialYear(user.joiningDate, financialYear);
  const possibleMonths = eligibleMonths.length;
  const payslips = await getPayslipsForFinancialYear(user.id, financialYear);
  const monthsElapsed = payslips.length;
  const actualTotals = sumPayslips(payslips);

  const annual = { annualBonusPay: actualTotals.annualBonusPay };
  for (const field of RECURRING_EARNING_FIELDS) annual[field] = 0;

  for (const { year, month } of eligibleMonths) {
    let breakdown = {};
    try {
      breakdown = await payrollService.computePayslip(user, year, month, {});
    } catch {
      breakdown = {};
    }
    for (const field of RECURRING_EARNING_FIELDS) {
      annual[field] += breakdown[field] || 0;
    }
  }

  return {
    mode: possibleMonths === 0 || monthsElapsed >= possibleMonths ? "FINAL" : "PROJECTED",
    monthsElapsed,
    annual,
    annualGross: totalGross(annual),
    tdsSoFar: actualTotals.tds,
  };
};

const getTaxDeclaration = (userId, financialYear) =>
  prisma.taxDeclaration.findUnique({ where: { userId_financialYear: { userId, financialYear } } });

const upsertTaxDeclaration = (userId, financialYear, data, recordedById) =>
  prisma.taxDeclaration.upsert({
    where: { userId_financialYear: { userId, financialYear } },
    update: { ...data, recordedById },
    create: { userId, financialYear, ...data, recordedById },
  });

// The full annual Income Tax Computation Statement for one employee, one
// financial year - matches the layout of the standard document this feature
// was modelled on (Gross Salary -> deductions -> Taxable Income -> slab tax
// -> cess -> less TDS already deducted -> Payable/Refundable).
const computeIncomeTaxStatement = async (userId, financialYear) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  // Defaults to New Regime if admin hasn't explicitly set one - that's the
  // government's own default choice for anyone who hasn't opted for Old Regime.
  const regime = user.taxRegime || TAX_REGIME.NEW;

  const { mode, monthsElapsed, annual, annualGross, tdsSoFar } = await getAnnualEarningsEstimate(user, financialYear);

  const declaration = await getTaxDeclaration(userId, financialYear);

  let deductions;
  let taxableSalary;

  if (regime === TAX_REGIME.OLD) {
    const standardDeduction = 50000;
    const hraExemption = computeHraExemption({
      basicAnnual: annual.basic,
      hraReceivedAnnual: annual.hra,
      rentPaidAnnual: declaration?.rentPaidAnnual || 0,
      isMetroCity: declaration?.isMetroCity || false,
    });
    const section80C = Math.min(declaration?.section80C || 0, SECTION_80C_CAP);
    const section80D = Math.min(declaration?.section80D || 0, SECTION_80D_CAP);
    const homeLoanInterest = Math.min(declaration?.homeLoanInterest || 0, HOME_LOAN_INTEREST_CAP);

    deductions = { standardDeduction, hraExemption, section80C, section80D, homeLoanInterest };
    taxableSalary = Math.max(
      annualGross - standardDeduction - hraExemption - section80C - section80D - homeLoanInterest,
      0
    );
  } else {
    const standardDeduction = 75000;
    deductions = { standardDeduction };
    taxableSalary = Math.max(annualGross - standardDeduction, 0);
  }

  const otherIncome = {
    savingsInterest: declaration?.otherIncomeSavingsInterest || 0,
    fdInterest: declaration?.otherIncomeFDInterest || 0,
  };
  const totalIncome = taxableSalary + otherIncome.savingsInterest + otherIncome.fdInterest;
  const totalIncomeRounded = roundToNearestTen(totalIncome);

  const age = user.birthDate ? getAgeAsOfFinancialYearEnd(user.birthDate, financialYear) : 30;
  const slabs = regime === TAX_REGIME.NEW ? NEW_REGIME_SLABS : getOldRegimeSlabs(age);

  const slabBreakdown = computeSlabBreakdown(totalIncomeRounded, slabs);
  const slabTax = slabBreakdown.reduce((sum, slab) => sum + slab.tax, 0);
  const taxAfterRebate = applyRebate87A(slabTax, totalIncomeRounded, regime);
  const cess = taxAfterRebate * 0.04;
  const totalTaxLiability = taxAfterRebate + cess;

  const netPosition = totalTaxLiability - tdsSoFar;
  const netPositionRounded = roundToNearestTen(Math.abs(netPosition));

  return {
    financialYear,
    assessmentYear: financialYear + 1,
    mode,
    monthsElapsed,
    regime,
    grossSalary: annualGross,
    deductions,
    taxableSalary,
    otherIncome,
    totalIncome,
    totalIncomeRounded,
    slabBreakdown,
    slabTax,
    rebate87A: slabTax - taxAfterRebate,
    cess,
    totalTaxLiability,
    tdsDeductedSoFar: tdsSoFar,
    taxPayable: netPosition > 0 ? netPositionRounded : 0,
    taxRefundable: netPosition < 0 ? netPositionRounded : 0,
  };
};

// Runs the same computation above, then freezes the result into a new,
// permanent IncomeTaxComputationGeneration row - a dated snapshot that stays
// exactly as it was even if payslips or the declaration change afterward.
// Generating again for the same employee + financial year creates another
// row alongside the earlier one; nothing gets overwritten.
const generateIncomeTaxComputation = async (userId, financialYear, generatedById) => {
  const statement = await computeIncomeTaxStatement(userId, financialYear);

  return prisma.incomeTaxComputationGeneration.create({
    data: {
      userId,
      financialYear,
      generatedById,
      regime: statement.regime,
      mode: statement.mode,
      monthsElapsed: statement.monthsElapsed,
      grossSalary: statement.grossSalary,
      standardDeduction: statement.deductions.standardDeduction,
      hraExemption: statement.deductions.hraExemption || 0,
      section80C: statement.deductions.section80C || 0,
      section80D: statement.deductions.section80D || 0,
      homeLoanInterest: statement.deductions.homeLoanInterest || 0,
      taxableSalary: statement.taxableSalary,
      otherIncomeSavingsInterest: statement.otherIncome.savingsInterest,
      otherIncomeFDInterest: statement.otherIncome.fdInterest,
      totalIncome: statement.totalIncome,
      totalIncomeRounded: statement.totalIncomeRounded,
      slabTax: statement.slabTax,
      rebate87A: statement.rebate87A,
      cess: statement.cess,
      totalTaxLiability: statement.totalTaxLiability,
      tdsDeductedSoFar: statement.tdsDeductedSoFar,
      taxPayable: statement.taxPayable,
      taxRefundable: statement.taxRefundable,
    },
  });
};

const listIncomeTaxComputationGenerations = (userId) =>
  prisma.incomeTaxComputationGeneration.findMany({
    where: { userId },
    orderBy: { generatedAt: "desc" },
  });

// Includes the employee's profile too, since the PDF's identity header
// (Name, PAN, Address, Bank details, etc.) is read live from the profile
// rather than duplicated into the frozen snapshot.
const getIncomeTaxComputationGeneration = (id) =>
  prisma.incomeTaxComputationGeneration.findUnique({
    where: { id },
    include: { user: true },
  });

// Slab tax is a pure function of (Total Income, regime, age) - rather than
// storing the breakdown in the database, it's recomputed on demand here for
// PDF rendering, using the frozen totalIncomeRounded/regime already saved on
// the generation plus the employee's current birthDate.
const getSlabBreakdownForGeneration = (generation, employee) => {
  const age = employee.birthDate ? getAgeAsOfFinancialYearEnd(employee.birthDate, generation.financialYear) : 30;
  const slabs = generation.regime === TAX_REGIME.NEW ? NEW_REGIME_SLABS : getOldRegimeSlabs(age);
  return computeSlabBreakdown(generation.totalIncomeRounded, slabs);
};

module.exports = {
  computeIncomeTaxStatement,
  getTaxDeclaration,
  upsertTaxDeclaration,
  generateIncomeTaxComputation,
  listIncomeTaxComputationGenerations,
  getIncomeTaxComputationGeneration,
  getSlabBreakdownForGeneration,
};
