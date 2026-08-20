const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const payrollService = require("../services/payroll.service");
const { streamPayslipPdf } = require("../services/payslipPdf.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3, deleteFromS3 } = require("../utils/s3.util");

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

  const payslip = await payrollService.generatePayslip(userId, year, month, { tds, annualBonusPay }, req.user.id);

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

  // Re-generating the same month overwrites this same row (see the upsert
  // above) - at this point payslip.pdfUrl still holds the PREVIOUS PDF, since
  // the upsert doesn't touch it, so remove that one now that its replacement
  // is safely uploaded.
  await deleteFromS3(payslip.pdfUrl);
  const updated = await prisma.payslip.update({ where: { id: payslip.id }, data: { pdfUrl: url } });

  new ApiResponse(200, "Payslip generated.", { payslip: updated }).send(res);
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
    pfMonthlyAmount,
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
      pfMonthlyAmount,
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

module.exports = {
  previewPayslip,
  generatePayslip,
  listPayslips,
  downloadPayslipPdf,
  getSalaryStructureHistory,
  recordSalaryStructure,
};
