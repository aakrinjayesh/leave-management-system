const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const userManagerService = require("../services/userManager.service");
const incomeTaxService = require("../services/incomeTax.service");
const resignationService = require("../services/resignation.service");
const { streamIncomeTaxComputationPdf } = require("../services/incomeTaxPdf.service");

// Any active user can be picked as someone's manager - not just Manager/Admin
// tier accounts.
const getManagerOptions = asyncHandler(async (req, res) => {
  const options = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: req.user.id } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });

  new ApiResponse(200, "OK", { options }).send(res);
});

const updateMyManager = asyncHandler(async (req, res) => {
  const { managerId } = req.body;

  if (managerId === req.user.id) {
    throw ApiError.badRequest("You can't set yourself as your own manager.");
  }

  const manager = await prisma.user.findFirst({ where: { id: managerId, status: "ACTIVE" } });
  if (!manager) {
    throw ApiError.badRequest("Please choose a valid person as your manager.");
  }

  await userManagerService.setUserManager(req.user.id, managerId);

  new ApiResponse(200, "Manager updated.").send(res);
});

// Completed years since joining, computed server-side (not trusted from the
// client) so the stored "last celebrated" value can't be spoofed.
const getYearsCompleted = (joiningDate) => {
  const start = new Date(joiningDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const hasHadAnniversaryThisYear =
    now.getMonth() > start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!hasHadAnniversaryThisYear) years -= 1;
  return years;
};

// Records the highest completed-years count this employee has been shown a
// celebration for, so the next call only re-fires once a new anniversary is
// actually reached (1 year, then 2, then 3...), not on every profile visit.
const markAnniversaryCelebrationSeen = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!existing?.joiningDate) {
    throw ApiError.badRequest("No joining date on file.");
  }

  const years = getYearsCompleted(existing.joiningDate);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { lastAnniversaryCelebratedYears: years },
  });

  new ApiResponse(200, "OK", { lastAnniversaryCelebratedYears: user.lastAnniversaryCelebratedYears }).send(res);
});

// Employee's own read-only Income Tax Computation, scoped to their own
// account only - same computation logic admin uses, just locked to the
// requester's own userId so no one can view anyone else's.
const getMyIncomeTaxComputation = asyncHandler(async (req, res) => {
  const financialYear = Number(req.query.financialYear);

  const statement = await incomeTaxService.computeIncomeTaxStatement(req.user.id, financialYear);

  new ApiResponse(200, "OK", { statement }).send(res);
});

// Every saved generation for the logged-in employee's own account only -
// read-only, matches how employees can view (but not create) their own past
// payslips; only admin can generate new ones.
const listMyIncomeTaxComputationGenerations = asyncHandler(async (req, res) => {
  const generations = await incomeTaxService.listIncomeTaxComputationGenerations(req.user.id);

  new ApiResponse(200, "OK", { generations }).send(res);
});

const downloadMyIncomeTaxComputationPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const generation = await incomeTaxService.getIncomeTaxComputationGeneration(id);
  if (!generation || generation.userId !== req.user.id) {
    throw ApiError.notFound("Income tax computation not found.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="income-tax-computation-${generation.user.firstName}-FY${generation.financialYear}.pdf"`
  );
  streamIncomeTaxComputationPdf({ generation, employee: generation.user }, res);
});

const submitMyResignation = asyncHandler(async (req, res) => {
  const { reason, proposedLastWorkingDate } = req.body;

  const resignation = await resignationService.submitResignation(req.user.id, reason, proposedLastWorkingDate);

  new ApiResponse(201, "Resignation submitted.", { resignation }).send(res);
});

const getMyResignation = asyncHandler(async (req, res) => {
  const resignation = await resignationService.getMyResignation(req.user.id);

  new ApiResponse(200, "OK", { resignation }).send(res);
});

const withdrawMyResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.withdrawResignation(req.user.id, id);

  new ApiResponse(200, "Resignation withdrawn.", { resignation }).send(res);
});

module.exports = {
  getManagerOptions,
  updateMyManager,
  markAnniversaryCelebrationSeen,
  getMyIncomeTaxComputation,
  listMyIncomeTaxComputationGenerations,
  downloadMyIncomeTaxComputationPdf,
  submitMyResignation,
  getMyResignation,
  withdrawMyResignation,
};
