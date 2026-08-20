const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const incomeTaxService = require("../services/incomeTax.service");
const { streamIncomeTaxComputationPdf } = require("../services/incomeTaxPdf.service");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3 } = require("../utils/s3.util");

const getTaxDeclaration = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const financialYear = Number(req.query.financialYear);

  const declaration = await incomeTaxService.getTaxDeclaration(userId, financialYear);

  new ApiResponse(200, "OK", { declaration }).send(res);
});

const upsertTaxDeclaration = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { financialYear, ...data } = req.body;

  const declaration = await incomeTaxService.upsertTaxDeclaration(userId, financialYear, data, req.user.id);

  new ApiResponse(200, "Tax declaration saved.", { declaration }).send(res);
});

const getIncomeTaxComputation = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const financialYear = Number(req.query.financialYear);

  const statement = await incomeTaxService.computeIncomeTaxStatement(userId, financialYear);

  new ApiResponse(200, "OK", { statement }).send(res);
});

const generateIncomeTaxComputation = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { financialYear } = req.body;

  const generation = await incomeTaxService.generateIncomeTaxComputation(userId, financialYear, req.user.id);
  const employee = await prisma.user.findUnique({ where: { id: userId } });

  const buffer = await renderPdfToBuffer(streamIncomeTaxComputationPdf, { generation, employee });
  const { url } = await uploadToS3(
    { buffer, originalname: `income-tax-computation-${employee.firstName}-FY${financialYear}.pdf`, mimetype: "application/pdf" },
    "income-tax-computations"
  );
  // Every generation is its own permanent, frozen snapshot (see the comment
  // on incomeTax.service.js's generateIncomeTaxComputation) - so unlike
  // payslips, there's no previous version of THIS row's PDF to clean up here.
  const updated = await prisma.incomeTaxComputationGeneration.update({
    where: { id: generation.id },
    data: { pdfUrl: url },
  });

  new ApiResponse(201, "Income tax computation generated.", { generation: updated }).send(res);
});

const listIncomeTaxComputationGenerations = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  const generations = await incomeTaxService.listIncomeTaxComputationGenerations(userId);

  new ApiResponse(200, "OK", { generations }).send(res);
});

const downloadIncomeTaxComputationPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const generation = await incomeTaxService.getIncomeTaxComputationGeneration(id);
  if (!generation) {
    throw ApiError.notFound("Income tax computation not found.");
  }

  if (generation.pdfUrl) {
    return res.redirect(generation.pdfUrl);
  }

  // Legacy generation created before PDFs were stored to S3 - render on demand.
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="income-tax-computation-${generation.user.firstName}-FY${generation.financialYear}.pdf"`
  );
  streamIncomeTaxComputationPdf({ generation, employee: generation.user }, res);
});

module.exports = {
  getTaxDeclaration,
  upsertTaxDeclaration,
  getIncomeTaxComputation,
  generateIncomeTaxComputation,
  listIncomeTaxComputationGenerations,
  downloadIncomeTaxComputationPdf,
};
