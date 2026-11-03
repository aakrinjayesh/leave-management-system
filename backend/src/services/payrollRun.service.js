const JSZip = require("jszip");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const payrollService = require("./payroll.service");
const attendanceService = require("./attendance.service");
const { streamPayslipPdf } = require("./payslipPdf.service");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3, deleteFromS3 } = require("../utils/s3.util");

// Company-wide payroll for one month: "Run Payroll" generates every salaried
// employee's payslip and bundles the PDFs into one ZIP; "Export Payroll" is
// the same set of employees as a flat sheet. Contract hires are on their own
// payment model and are never included.

const monthName = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", timeZone: "UTC" });

const mmyyyy = (year, month) => `${String(month).padStart(2, "0")}${year}`;

// Payroll_October2026.zip
const zipFileName = (year, month) => `Payroll_${monthName(year, month)}${year}.zip`;

// Characters Windows won't allow in a file name.
const safeFilePart = (value) => String(value).replace(/[\\/:*?"<>|]/g, "").trim();

// Ravi Kumar_AAK012_102026.pdf
const payslipFileName = (user, year, month) =>
  [safeFilePart(`${user.firstName} ${user.lastName}`), user.employeeCode && safeFilePart(user.employeeCode), mmyyyy(year, month)]
    .filter(Boolean)
    .join("_") + ".pdf";

const employeeCodeSeq = (code) => {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const fullName = (user) => `${user.firstName} ${user.lastName}`;

// Salaried employees who should be paid for the month: not a contract hire,
// joined on or before the month's last day, and either still active or exited
// on/after the month's first day (their final month still gets a payslip).
const getRunScope = async (year, month) => {
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  const users = await prisma.user.findMany({
    where: {
      employmentType: { not: "CONTRACT" },
      OR: [{ joiningDate: null }, { joiningDate: { lte: monthEnd } }],
      AND: [{ OR: [{ status: "ACTIVE" }, { status: "INACTIVE", exitDate: { gte: monthStart } }] }],
    },
  });

  return users.sort((a, b) => {
    const diff = employeeCodeSeq(a.employeeCode) - employeeCodeSeq(b.employeeCode);
    return diff !== 0 ? diff : fullName(a).localeCompare(fullName(b));
  });
};

// Employees with no CTC on file at all for that month - computePayslip would
// reject them, so they're listed up front and skipped by the run.
const findMissingSalary = async (users, year, month) => {
  const missing = [];
  for (const user of users) {
    if (user.salaryCtc) continue;
    const config = await payrollService.getEffectiveSalaryConfig(user.id, year, month);
    if (!config) missing.push(user);
  }
  return missing;
};

const toSummary = (user) => ({ userId: user.id, employeeName: fullName(user), employeeCode: user.employeeCode });

// What the admin sees before running: who's included, who still has
// not-marked attendance days (blocks the run), and who has no salary set
// (skipped).
const checkRun = async (year, month) => {
  const users = await getRunScope(year, month);
  const [unmarkedAttendance, missingSalary, existing] = await Promise.all([
    attendanceService.findUnmarkedEmployees(
      users.map((u) => u.id),
      year,
      month
    ),
    findMissingSalary(users, year, month),
    prisma.payslip.count({ where: { year, month, userId: { in: users.map((u) => u.id) } } }),
  ]);

  return {
    year,
    month,
    employeeCount: users.length,
    alreadyGeneratedCount: existing,
    unmarkedAttendance,
    missingSalary: missingSalary.map(toSummary),
  };
};

// Generates (or re-generates) one payslip, renders its PDF and stores it on
// S3, replacing any previous PDF for the same month. Shared by the single
// employee "Generate" button and Run Payroll.
const generateAndStorePayslip = async (userId, year, month, { tds, annualBonusPay }, generatedById) => {
  const payslip = await payrollService.generatePayslip(userId, year, month, { tds, annualBonusPay }, generatedById);

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  const ytd = await payrollService.getYtdTotals(userId, year, month);

  const buffer = await renderPdfToBuffer(streamPayslipPdf, { payslip, employee, ytd });
  const { url } = await uploadToS3(
    {
      buffer,
      originalname: `payslip-${employee.firstName}-${year}-${String(month).padStart(2, "0")}.pdf`,
      mimetype: "application/pdf",
    },
    "payslips"
  );

  // Re-generating the same month overwrites this same row (generatePayslip
  // upserts) - payslip.pdfUrl still holds the PREVIOUS PDF here, since the
  // upsert doesn't touch it, so remove that one now that its replacement is
  // safely uploaded.
  await deleteFromS3(payslip.pdfUrl);
  const updated = await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfUrl: url } });

  return { payslip: updated, employee, buffer };
};

// Generates every in-scope employee's payslip for the month and returns them
// as one ZIP. An already-generated payslip keeps the TDS / bonus admin
// entered for it; otherwise both are 0. Refuses to start while anyone has a
// not-marked attendance day. Employees that fail (e.g. no salary set) are
// skipped and listed in a text file inside the ZIP.
const runPayroll = async (year, month, generatedById) => {
  const users = await getRunScope(year, month);
  if (users.length === 0) {
    throw ApiError.badRequest("There are no salaried employees to run payroll for in this month.");
  }

  const unmarked = await attendanceService.findUnmarkedEmployees(
    users.map((u) => u.id),
    year,
    month
  );
  if (unmarked.length > 0) {
    throw ApiError.badRequest(
      `Attendance isn't complete for ${unmarked.length} employee${unmarked.length === 1 ? "" : "s"}: ${unmarked
        .map((u) => u.employeeName)
        .join(", ")}. Every working day must be marked before running payroll.`,
      { unmarkedAttendance: unmarked }
    );
  }

  const existingPayslips = await prisma.payslip.findMany({
    where: { year, month, userId: { in: users.map((u) => u.id) } },
    select: { userId: true, tds: true, annualBonusPay: true },
  });
  const existingByUser = new Map(existingPayslips.map((p) => [p.userId, p]));

  const zip = new JSZip();
  const usedNames = new Set();
  const skipped = [];

  for (const user of users) {
    const existing = existingByUser.get(user.id);
    try {
      const { buffer } = await generateAndStorePayslip(
        user.id,
        year,
        month,
        { tds: existing?.tds ?? 0, annualBonusPay: existing?.annualBonusPay ?? 0 },
        generatedById
      );

      let name = payslipFileName(user, year, month);
      if (usedNames.has(name)) name = name.replace(/\.pdf$/, `_${user.id}.pdf`);
      usedNames.add(name);
      zip.file(name, buffer);
    } catch (err) {
      skipped.push(`${fullName(user)}${user.employeeCode ? ` (${user.employeeCode})` : ""}: ${err.message}`);
    }
  }

  if (skipped.length === users.length) {
    throw ApiError.badRequest(`No payslips could be generated. ${skipped.join(" ")}`);
  }

  if (skipped.length > 0) {
    zip.file("Skipped employees.txt", `Payslips that couldn't be generated:\r\n\r\n${skipped.join("\r\n")}\r\n`);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { buffer, fileName: zipFileName(year, month), generatedCount: users.length - skipped.length, skippedCount: skipped.length };
};

const PAYSLIP_EXPORT_FIELDS = [
  "standardDays",
  "daysWorked",
  "lopDays",
  "basic",
  "hra",
  "lta",
  "conveyance",
  "guaranteedAllowance",
  "specialAllowance",
  "annualBonusPay",
  "grossPay",
  "pfEmployee",
  "pfEmployer",
  "professionalTax",
  "tds",
  "lopAmount",
  "grossDeductions",
  "netPay",
];

// Every in-scope employee's details plus that month's payslip figures, for
// the Export Payroll sheet. Employees without a payslip yet still get a row
// (hasPayslip false, figures blank) so nobody silently drops off the sheet.
const getExportRows = async (year, month) => {
  const users = await getRunScope(year, month);
  const payslips = await prisma.payslip.findMany({ where: { year, month, userId: { in: users.map((u) => u.id) } } });
  const payslipByUser = new Map(payslips.map((p) => [p.userId, p]));

  const rows = users.map((user) => {
    const payslip = payslipByUser.get(user.id);
    const row = {
      employeeCode: user.employeeCode,
      name: fullName(user),
      designation: user.designation,
      email: user.email,
      joiningDate: user.joiningDate,
      pan: user.pan,
      uan: user.uan,
      pfNumber: user.pfNumber,
      bankName: user.bankName,
      bankAccountNumber: user.bankAccountNumber,
      ifscCode: user.ifscCode,
      ctc: user.salaryCtc,
      hasPayslip: Boolean(payslip),
    };
    for (const field of PAYSLIP_EXPORT_FIELDS) row[field] = payslip ? payslip[field] : null;
    return row;
  });

  return { year, month, fields: PAYSLIP_EXPORT_FIELDS, rows };
};

module.exports = {
  checkRun,
  runPayroll,
  generateAndStorePayslip,
  getExportRows,
};
