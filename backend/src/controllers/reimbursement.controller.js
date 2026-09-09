const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const reimbursementService = require("../services/reimbursement.service");
const notificationService = require("../services/notification.service");
const { sendReimbursementCancelledEmail } = require("../utils/email.util");

const listMine = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const claims = await prisma.reimbursement.findMany({
    where: { userId: req.user.id, ...(status ? { status } : {}) },
    include: reimbursementService.CLAIM_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  new ApiResponse(200, "OK", { claims }).send(res);
});

const getMine = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const claim = await prisma.reimbursement.findFirst({
    where: { id, userId: req.user.id },
    include: reimbursementService.CLAIM_INCLUDE,
  });
  if (!claim) {
    throw ApiError.notFound("Reimbursement claim not found.");
  }
  new ApiResponse(200, "OK", { claim }).send(res);
});

const create = asyncHandler(async (req, res) => {
  const { subject, description, amount } = req.body;

  const { claim } = await reimbursementService.createOwnClaim({
    claimant: req.user,
    subject,
    description,
    amount,
    files: req.files,
  });

  new ApiResponse(201, "Reimbursement claim submitted.", { claim }).send(res);

  await reimbursementService.sendSubmitSideEffects({ claim, claimant: req.user });
});

const cancel = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const claim = await prisma.reimbursement.findUnique({
    where: { id },
    include: { routedTo: true },
  });
  if (!claim || claim.userId !== req.user.id) {
    throw ApiError.notFound("Reimbursement claim not found.");
  }
  if (claim.status !== "PENDING") {
    throw ApiError.badRequest("This claim has already been actioned and can no longer be cancelled.");
  }

  const updated = await prisma.reimbursement.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: reimbursementService.CLAIM_INCLUDE,
  });

  new ApiResponse(200, "Reimbursement claim cancelled.", { claim: updated }).send(res);

  // Let whoever it was routed to know it's off the table.
  const claimantName = `${req.user.firstName} ${req.user.lastName}`;
  let recipients = [];
  try {
    recipients = await reimbursementService.getNoticeRecipients(req.user);
    await notificationService.notifyMany(
      recipients.map((r) => r.id),
      {
        type: notificationService.NOTIFICATION_TYPES.REIMBURSEMENT_CANCELLED,
        title: "Reimbursement claim cancelled",
        message: `${claimantName} cancelled their reimbursement claim (${claim.subject}, ${reimbursementService.formatMoney(
          claim.amount
        )}).`,
      }
    );
  } catch (err) {
    console.error("Failed to create reimbursement cancelled notification:", err);
  }

  for (const recipient of recipients) {
    try {
      await sendReimbursementCancelledEmail({
        to: recipient.email,
        recipientFirstName: recipient.firstName,
        claimantName,
        subject: claim.subject,
        amount: reimbursementService.formatMoney(claim.amount),
      });
    } catch (err) {
      console.error("Failed to send reimbursement cancelled email:", err);
    }
  }
});

// Redirects to the S3 URL of one attachment on one of the caller's own claims.
const getMyAttachment = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);

  const attachment = await prisma.reimbursementAttachment.findFirst({
    where: { id: attachmentId, reimbursementId: id, reimbursement: { userId: req.user.id } },
  });
  if (!attachment) {
    throw ApiError.notFound("Attachment not found.");
  }
  res.redirect(attachment.fileUrl);
});

module.exports = { listMine, getMine, create, cancel, getMyAttachment };
