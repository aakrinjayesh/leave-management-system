const prisma = require("../config/prisma");
const companySettingsService = require("./companySettings.service");
const { getFiscalYear } = require("../utils/fiscalYear.util");

// Consolidated payroll register for the admin "Report" tab. Read-only - it
// only aggregates already-generated Payslip / ContractPayment rows, never
// recomputes anything.

// Every numeric column of the Employees register, in display order.
const EMPLOYEE_FIELDS = [
  "basic",
  "hra",
  "lta",
  "conveyance",
  "specialAllowance",
  "guaranteedAllowance",
  "annualBonusPay",
  "pfEmployer",
  "grossPay",
  "pfEmployee",
  "professionalTax",
  "tds",
  "lopAmount",
  "grossDeductions",
  "netPay",
];

// Contract register - grossPayment / tdsAmount / netPayment sum across months;
// tdsRatePercent is only meaningful for a single month.
const CONTRACT_SUM_FIELDS = ["grossPayment", "tdsAmount", "netPayment"];

// Trailing digits of an employee code are one running sequence across every
// prefix (mirrors admin.controller's listUsers sort). No code sorts last.
const employeeCodeSeq = (code) => {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const sortByCode = (rows) =>
  [...rows].sort((a, b) => {
    const sa = employeeCodeSeq(a.employeeCode);
    const sb = employeeCodeSeq(b.employeeCode);
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

const sumInto = (target, source, fields) => {
  for (const f of fields) target[f] = (target[f] || 0) + (source[f] || 0);
};

// Picks the payslip/payment rows that count for the requested view:
//  - "monthly": just the one row for {year, month}
//  - "cumulative": every row in the same fiscal year, up to and including
//    {year, month}
const relevantRows = (rows, year, month, mode, fiscalYearStartMonth) => {
  if (mode === "monthly") {
    return rows.filter((r) => r.year === year && r.month === month);
  }
  const fiscalYearOf = (y, m) => getFiscalYear(new Date(Date.UTC(y, m - 1, 1)), fiscalYearStartMonth);
  const targetFy = fiscalYearOf(year, month);
  const targetSeq = year * 12 + month;
  return rows.filter((r) => fiscalYearOf(r.year, r.month) === targetFy && r.year * 12 + r.month <= targetSeq);
};

const getEmployeeRegister = async (year, month, mode) => {
  const { fiscalYearStartMonth } = await companySettingsService.getSettings();

  const users = await prisma.user.findMany({
    where: { userType: { not: "ADMIN" }, employmentType: { not: "CONTRACT" } },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });
  const payslips = await prisma.payslip.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
  const byUser = new Map();
  for (const p of payslips) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId).push(p);
  }

  const rows = users.map((u) => {
    const picked = relevantRows(byUser.get(u.id) || [], year, month, mode, fiscalYearStartMonth);
    const row = {
      userId: u.id,
      employeeCode: u.employeeCode || null,
      name: `${u.firstName} ${u.lastName}`,
      hasData: picked.length > 0,
      monthsCounted: picked.length,
    };
    for (const f of EMPLOYEE_FIELDS) row[f] = 0;
    for (const p of picked) sumInto(row, p, EMPLOYEE_FIELDS);
    return row;
  });

  const sorted = sortByCode(rows);
  const totals = { name: "Total" };
  for (const f of EMPLOYEE_FIELDS) totals[f] = 0;
  for (const r of sorted) if (r.hasData) sumInto(totals, r, EMPLOYEE_FIELDS);

  return { fields: EMPLOYEE_FIELDS, rows: sorted, totals };
};

const getContractRegister = async (year, month, mode) => {
  const { fiscalYearStartMonth } = await companySettingsService.getSettings();

  const users = await prisma.user.findMany({
    where: { userType: { not: "ADMIN" }, employmentType: "CONTRACT" },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });
  const payments = await prisma.contractPayment.findMany({ where: { userId: { in: users.map((u) => u.id) } } });
  const byUser = new Map();
  for (const p of payments) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId).push(p);
  }

  const rows = users.map((u) => {
    const picked = relevantRows(byUser.get(u.id) || [], year, month, mode, fiscalYearStartMonth);
    const row = {
      userId: u.id,
      employeeCode: u.employeeCode || null,
      name: `${u.firstName} ${u.lastName}`,
      hasData: picked.length > 0,
      monthsCounted: picked.length,
      // Only shown in monthly view (a single rate); null when it spans months.
      tdsRatePercent: mode === "monthly" && picked.length === 1 ? picked[0].tdsRatePercent : null,
      grossPayment: 0,
      tdsAmount: 0,
      netPayment: 0,
    };
    for (const p of picked) sumInto(row, p, CONTRACT_SUM_FIELDS);
    return row;
  });

  const sorted = sortByCode(rows);
  const totals = { name: "Total", grossPayment: 0, tdsAmount: 0, netPayment: 0 };
  for (const r of sorted) if (r.hasData) sumInto(totals, r, CONTRACT_SUM_FIELDS);

  return { fields: ["grossPayment", "tdsRatePercent", "tdsAmount", "netPayment"], rows: sorted, totals };
};

module.exports = {
  EMPLOYEE_FIELDS,
  getEmployeeRegister,
  getContractRegister,
};
