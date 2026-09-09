const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const reimbursementService = require("../services/reimbursement.service");

// Trailing digits of an employee code, as one running sequence - mirrors the
// admin list ordering used elsewhere (code hidden, but rows sort by it).
const employeeCodeSeq = (code) => {
  if (!code) return Number.POSITIVE_INFINITY;
  const match = code.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : Number.POSITIVE_INFINITY;
};

const listAll = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const claims = await prisma.reimbursement.findMany({
    where: status ? { status } : undefined,
    include: reimbursementService.CLAIM_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  claims.sort((a, b) => {
    if (a.status !== b.status) return a.status === "PENDING" ? -1 : b.status === "PENDING" ? 1 : 0;
    const sa = employeeCodeSeq(a.user.employeeCode);
    const sb = employeeCodeSeq(b.user.employeeCode);
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  new ApiResponse(200, "OK", { claims }).send(res);
});

const getClaimOr404 = async (id) => {
  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: reimbursementService.CLAIM_INCLUDE,
  });
  if (!claim) {
    throw ApiError.notFound("Reimbursement claim not found.");
  }
  return claim;
};

const decide = (decision) =>
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { remarks } = req.body;

    const claim = await getClaimOr404(id);
    if (claim.userId === req.user.id) {
      throw ApiError.badRequest("You can't action your own reimbursement claim.");
    }

    const updated = await reimbursementService.applyDecision({ claim, actor: req.user, decision, remarks });

    new ApiResponse(
      200,
      decision === "APPROVED" ? "Reimbursement claim approved." : "Reimbursement claim rejected.",
      { claim: updated }
    ).send(res);

    await reimbursementService.sendDecisionSideEffects({ claim: updated, actor: req.user, decision, remarks });
  });

const logForUser = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { subject, description, amount } = req.body;

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee || employee.id === req.user.id) {
    throw ApiError.notFound("Account not found.");
  }

  const claim = await reimbursementService.logClaimForEmployee({
    employee,
    actor: req.user,
    subject,
    description,
    amount,
    files: req.files,
    loggedByAdmin: employee.managerId !== req.user.id,
  });

  new ApiResponse(201, "Reimbursement claim logged and approved.", { claim }).send(res);

  await reimbursementService.sendLoggedSideEffects({ claim, employee, actor: req.user });
});

const getAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);

  const attachment = await prisma.reimbursementAttachment.findFirst({
    where: { id: attachmentId, reimbursementId: id },
  });
  if (!attachment) {
    throw ApiError.notFound("Attachment not found.");
  }
  res.redirect(attachment.fileUrl);
});

module.exports = {
  listAll,
  approve: decide("APPROVED"),
  reject: decide("REJECTED"),
  logForUser,
  getAttachment,
};
