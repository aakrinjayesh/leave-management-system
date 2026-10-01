const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const reimbursementService = require("../services/reimbursement.service");

const getDirectReportOr404 = async (employeeId, managerId) => {
  const employee = await prisma.user.findUnique({ where: { id: employeeId } });
  if (!employee || employee.managerId !== managerId) {
    throw ApiError.notFound("Employee not found.");
  }
  return employee;
};

// Pending queue + recent history for claims routed to this manager.
const listTeam = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const claims = await prisma.reimbursement.findMany({
    where: { routedToId: req.user.id, ...(status ? { status } : {}) },
    include: reimbursementService.CLAIM_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  new ApiResponse(200, "OK", { claims }).send(res);
});

const getRoutedClaimOr404 = async (id, managerId) => {
  const claim = await prisma.reimbursement.findFirst({
    where: { id, routedToId: managerId },
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

    const claim = await getRoutedClaimOr404(id, req.user.id);
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

const logForEmployee = asyncHandler(async (req, res) => {
  const employee = await getDirectReportOr404(Number(req.params.id), req.user.id);
  const { subject, description, amount } = req.body;

  const claim = await reimbursementService.logClaimForEmployee({
    employee,
    actor: req.user,
    subject,
    description,
    amount,
    files: req.files,
    loggedByAdmin: false,
  });

  new ApiResponse(201, "Reimbursement claim logged and approved.", { claim }).send(res);

  await reimbursementService.sendLoggedSideEffects({ claim, employee, actor: req.user });
});

const getAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);

  const attachment = await prisma.reimbursementAttachment.findFirst({
    where: {
      id: attachmentId,
      reimbursementId: id,
      reimbursement: { OR: [{ routedToId: req.user.id }, { user: { managerId: req.user.id } }] },
    },
  });
  if (!attachment) {
    throw ApiError.notFound("Attachment not found.");
  }
  res.redirect(attachment.fileUrl);
});

module.exports = {
  listTeam,
  approve: decide("APPROVED"),
  reject: decide("REJECTED"),
  logForEmployee,
  getAttachment,
};
