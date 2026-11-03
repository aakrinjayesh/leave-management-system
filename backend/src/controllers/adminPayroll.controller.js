const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const payrollService = require("../services/payroll.service");
const payrollRunService = require("../services/payrollRun.service");
const { streamPayslipPdf } = require("../services/payslipPdf.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3 } = require("../utils/s3.util");
const { sendPayslipEmail, sendSalaryStructureUpdatedEmail } = require("../utils/email.util");

const monthLabel = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

// Computes what a payslip would look like without saving it, so admin can
// see the numbers before confirming.
const previewPayslip = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const tds = Number(req.query.tds) || 0;
  const annualBonusPay = Number(req.query.annualBonusPay) || 0;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  const computed = await payrollService.computePayslip(user, year, month, { tds, annualBonusPay });
  const priorYtd = await payrollService.getYtdTotals(userId, year, month);
  const ytd = payrollService.addToYtdTotals(priorYtd, computed);

  new ApiResponse(200, "OK", { computed, ytd }).send(res);
});

const generatePayslip = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { year, month, tds, annualBonusPay } = req.body;

  const { payslip } = await payrollRunService.generateAndStorePayslip(userId, year, month, { tds, annualBonusPay }, req.user.id);

  new ApiResponse(200, "Payslip generated.", { payslip }).send(res);
});

// ── Company-wide payroll (Run Payroll / Export Payroll) ──────────────────

const parsePayrollMonth = (source) => {
  const year = Number(source.year);
  const month = Number(source.month);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw ApiError.badRequest("Please choose a valid month.");
  }
  return { year, month };
};

// Pre-flight for Run Payroll - who's included, who has unmarked attendance
// (blocks the run) and who has no salary set (skipped).
const checkPayrollRun = asyncHandler(async (req, res) => {
  const { year, month } = parsePayrollMonth(req.query);
  const data = await payrollRunService.checkRun(year, month);
  new ApiResponse(200, "OK", data).send(res);
});

// Generates every salaried employee's payslip for the month and downloads
// them as one ZIP (Payroll_MonthYYYY.zip).
const runPayroll = asyncHandler(async (req, res) => {
  const { year, month } = parsePayrollMonth(req.body);
  const { buffer, fileName, generatedCount, skippedCount } = await payrollRunService.runPayroll(year, month, req.user.id);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("X-Payroll-Generated", String(generatedCount));
  res.setHeader("X-Payroll-Skipped", String(skippedCount));
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Payroll-Generated, X-Payroll-Skipped");
  res.send(buffer);
});

const exportPayroll = asyncHandler(async (req, res) => {
  const { year, month } = parsePayrollMonth(req.query);
  const data = await payrollRunService.getExportRows(year, month);
  new ApiResponse(200, "OK", data).send(res);
});

const listPayslips = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  const payslips = await prisma.payslip.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  new ApiResponse(200, "OK", { payslips }).send(res);
});

const getSalaryStructureHistory = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const history = await payrollService.getSalaryStructureHistory(userId);
  new ApiResponse(200, "OK", { history }).send(res);
});

const recordSalaryStructure = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const {
    ctc,
    effectiveFrom,
    basicPercentOfCtc,
    hraPercentOfBasic,
    ltaPercentOfBasic,
    guaranteedAllowancePercentOfBasic,
    conveyanceMonthly,
    professionalTax,
    professionalTaxThreshold,
  } = req.body;

  const history = await payrollService.recordSalaryStructure(
    userId,
    {
      ctc,
      effectiveFrom,
      basicPercentOfCtc,
      hraPercentOfBasic,
      ltaPercentOfBasic,
      guaranteedAllowancePercentOfBasic,
      conveyanceMonthly,
      professionalTax,
      professionalTaxThreshold,
    },
    req.user.id
  );

  new ApiResponse(201, "Salary structure recorded.", { history }).send(res);

  // Sent after the response so the admin doesn't wait on it; failures here
  // shouldn't fail the salary structure update itself.
  try {
    await notificationService.notify({
      userId,
      type: notificationService.NOTIFICATION_TYPES.SALARY_STRUCTURE_UPDATED,
      title: "Salary structure updated",
      message: `Your CTC has been updated to ₹${Number(ctc).toLocaleString("en-IN")}, effective ${formatDateShort(
        effectiveFrom
      )}.`,
    });
  } catch (err) {
    console.error("Failed to create salary structure notification:", err);
  }

  try {
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (employee) {
      await sendSalaryStructureUpdatedEmail({
        to: employee.email,
        firstName: employee.firstName,
        ctc,
        effectiveFrom,
      });
    }
  } catch (err) {
    console.error("Failed to send salary structure updated email:", err);
  }
});

// In-place correction of the most recent structure entry (no new revision) -
// see payrollService.updateLatestSalaryStructure.
const updateLatestSalaryStructure = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const {
    ctc,
    effectiveFrom,
    basicPercentOfCtc,
    hraPercentOfBasic,
    ltaPercentOfBasic,
    guaranteedAllowancePercentOfBasic,
    conveyanceMonthly,
    professionalTax,
    professionalTaxThreshold,
  } = req.body;

  const history = await payrollService.updateLatestSalaryStructure(
    userId,
    {
      ctc,
      effectiveFrom,
      basicPercentOfCtc,
      hraPercentOfBasic,
      ltaPercentOfBasic,
      guaranteedAllowancePercentOfBasic,
      conveyanceMonthly,
      professionalTax,
      professionalTaxThreshold,
    },
    req.user.id
  );

  new ApiResponse(200, "Salary structure updated.", { history }).send(res);

  try {
    await notificationService.notify({
      userId,
      type: notificationService.NOTIFICATION_TYPES.SALARY_STRUCTURE_UPDATED,
      title: "Salary structure updated",
      message: `Your CTC has been updated to ₹${Number(ctc).toLocaleString("en-IN")}, effective ${formatDateShort(
        effectiveFrom
      )}.`,
    });
  } catch (err) {
    console.error("Failed to create salary structure notification:", err);
  }

  try {
    const employee = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true },
    });
    if (employee) {
      await sendSalaryStructureUpdatedEmail({
        to: employee.email,
        firstName: employee.firstName,
        ctc,
        effectiveFrom,
      });
    }
  } catch (err) {
    console.error("Failed to send salary structure updated email:", err);
  }
});

const downloadPayslipPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const payslip = await prisma.payslip.findUnique({ where: { id } });
  if (!payslip) {
    throw ApiError.notFound("Payslip not found.");
  }

  if (payslip.pdfUrl) {
    return res.redirect(payslip.pdfUrl);
  }

  // Legacy payslip generated before PDFs were stored to S3 - render on demand.
  const employee = await prisma.user.findUnique({ where: { id: payslip.userId } });
  const ytd = await payrollService.getYtdTotals(payslip.userId, payslip.year, payslip.month);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="payslip-${employee.firstName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf"`
  );
  streamPayslipPdf({ payslip, employee, ytd }, res);
});

// Emails the employee a link to this payslip's PDF. Generates + stores the
// PDF first if this (older) payslip never had one.
const emailPayslip = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const payslipId = Number(req.params.payslipId);

  const payslip = await prisma.payslip.findUnique({ where: { id: payslipId } });
  if (!payslip || payslip.userId !== userId) {
    throw ApiError.notFound("Payslip not found.");
  }

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }
  if (!employee.email) {
    throw ApiError.badRequest("This account has no email address to send to.");
  }

  let pdfUrl = payslip.pdfUrl;
  if (!pdfUrl) {
    const ytd = await payrollService.getYtdTotals(userId, payslip.year, payslip.month);
    const buffer = await renderPdfToBuffer(streamPayslipPdf, { payslip, employee, ytd });
    const uploaded = await uploadToS3(
      {
        buffer,
        originalname: `payslip-${employee.firstName}-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf`,
        mimetype: "application/pdf",
      },
      "payslips"
    );
    pdfUrl = uploaded.url;
    await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfUrl } });
  }

  const periodLabel = monthLabel(payslip.year, payslip.month);

  try {
    await sendPayslipEmail({
      to: employee.email,
      firstName: employee.firstName,
      periodLabel,
      grossPay: payslip.grossPay,
      grossDeductions: payslip.grossDeductions,
      netPay: payslip.netPay,
      downloadUrl: pdfUrl,
    });
  } catch (err) {
    console.error("Failed to send payslip email:", err);
    throw ApiError.badRequest("Couldn't send the email. Please try again.");
  }

  new ApiResponse(200, "Payslip emailed.", { sentTo: employee.email }).send(res);
});

module.exports = {
  previewPayslip,
  generatePayslip,
  checkPayrollRun,
  runPayroll,
  exportPayroll,
  listPayslips,
  downloadPayslipPdf,
  emailPayslip,
  getSalaryStructureHistory,
  recordSalaryStructure,
  updateLatestSalaryStructure,
};
