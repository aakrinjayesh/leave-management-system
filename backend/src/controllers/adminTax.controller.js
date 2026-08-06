const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const incomeTaxService = require("../services/incomeTax.service");
const { streamIncomeTaxComputationPdf } = require("../services/incomeTaxPdf.service");

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

  new ApiResponse(201, "Income tax computation generated.", { generation }).send(res);
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
