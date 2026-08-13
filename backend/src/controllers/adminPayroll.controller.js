const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const payrollService = require("../services/payroll.service");
const { streamPayslipPdf } = require("../services/payslipPdf.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

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

  new ApiResponse(200, "Payslip generated.", { payslip }).send(res);
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
