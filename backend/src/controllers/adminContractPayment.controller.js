const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const contractPaymentService = require("../services/contractPayment.service");
const { streamContractPaymentPdf } = require("../services/contractPaymentPdf.service");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3, deleteFromS3 } = require("../utils/s3.util");

// All endpoints here are admin-only (mounted under the admin router) and apply
// only to employmentType = CONTRACT accounts - the service enforces that.

const getStructureHistory = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const history = await contractPaymentService.getStructureHistory(userId);
  new ApiResponse(200, "OK", { history }).send(res);
});

const recordStructure = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const history = await contractPaymentService.recordStructure(userId, req.body, req.user.id);
  new ApiResponse(201, "Contract payment structure recorded.", { history }).send(res);
});

const updateLatestStructure = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const history = await contractPaymentService.updateLatestStructure(userId, req.body, req.user.id);
  new ApiResponse(200, "Contract payment structure updated.", { history }).send(res);
});

const previewPayment = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  const computed = await contractPaymentService.previewPayment(userId, year, month);
  new ApiResponse(200, "OK", { computed }).send(res);
});

const listPayments = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const payments = await contractPaymentService.listPayments(userId);
  new ApiResponse(200, "OK", { payments }).send(res);
});

const generatePayment = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { year, month } = req.body;

  const payment = await contractPaymentService.generatePayment(userId, year, month, req.user.id);
  const employee = await prisma.user.findUnique({ where: { id: userId } });

  const buffer = await renderPdfToBuffer(streamContractPaymentPdf, { payment, employee });
  const { url } = await uploadToS3(
    {
      buffer,
      originalname: `contract-payslip-${employee.firstName}-${year}-${String(month).padStart(2, "0")}.pdf`,
      mimetype: "application/pdf",
    },
    "contract-payslips"
  );

  await deleteFromS3(payment.pdfUrl);
  const updated = await prisma.contractPayment.update({ where: { id: payment.id }, data: { pdfUrl: url } });

  new ApiResponse(200, "Contract payslip generated.", { payment: updated }).send(res);
});

const downloadPaymentPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const payment = await prisma.contractPayment.findUnique({ where: { id } });
  if (!payment) {
    throw ApiError.notFound("Contract payslip not found.");
  }

  if (payment.pdfUrl) {
    return res.redirect(payment.pdfUrl);
  }

  const employee = await prisma.user.findUnique({ where: { id: payment.userId } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="contract-payslip-${employee.firstName}-${payment.year}-${String(payment.month).padStart(2, "0")}.pdf"`
  );
  streamContractPaymentPdf({ payment, employee }, res);
});

module.exports = {
  getStructureHistory,
  recordStructure,
  updateLatestStructure,
  previewPayment,
  listPayments,
  generatePayment,
  downloadPaymentPdf,
};
