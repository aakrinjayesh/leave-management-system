const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const notificationService = require("./notification.service");
const { uploadToS3 } = require("../utils/s3.util");
const {
  sendReimbursementSubmittedEmail,
  sendReimbursementDecisionEmail,
  sendReimbursementLoggedEmail,
} = require("../utils/email.util");

const CLAIM_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, email: true, employeeCode: true } },
  routedTo: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  attachments: { orderBy: { id: "asc" } },
};

const formatMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Uploads each multer file to S3 and returns rows ready for a nested create.
const uploadAttachments = async (files) => {
  const uploaded = [];
  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const { url } = await uploadToS3(file, "reimbursement-attachments");
    uploaded.push({ fileUrl: url, fileName: file.originalname });
  }
  return uploaded;
};

// Every active admin, plus the claimant's own active manager if they have one
// - the audience for a new/cancelled claim (mirrors WFH / resignation).
const getNoticeRecipients = async (claimant) => {
  const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
  const byId = new Map(admins.map((a) => [a.id, a]));

  if (claimant.managerId) {
    const manager = await prisma.user.findFirst({ where: { id: claimant.managerId, status: "ACTIVE" } });
    if (manager) byId.set(manager.id, manager);
  }
  // Never notify the claimant themselves (an admin/manager filing their own).
  byId.delete(claimant.id);
  return [...byId.values()];
};

// Employee (or manager/admin) files their own claim. Routes to their manager
// if they have one; otherwise routedToId stays null and only an admin can act.
const createOwnClaim = async ({ claimant, subject, description, amount, files }) => {
  if (!files || files.length === 0) {
    throw ApiError.badRequest("Please attach at least one supporting file.");
  }

  const recipient = claimant.managerId
    ? await prisma.user.findFirst({ where: { id: claimant.managerId, status: "ACTIVE" } })
    : null;

  const attachments = await uploadAttachments(files);

  const claim = await prisma.reimbursement.create({
    data: {
      userId: claimant.id,
      routedToId: recipient?.id ?? null,
      subject,
      description,
      amount,
      status: "PENDING",
      attachments: { create: attachments },
    },
    include: CLAIM_INCLUDE,
  });

  return { claim, recipient };
};

const sendSubmitSideEffects = async ({ claim, claimant }) => {
  const claimantName = `${claimant.firstName} ${claimant.lastName}`;
  let recipients = [];
  try {
    recipients = await getNoticeRecipients(claimant);
    await notificationService.notifyMany(
      recipients.map((r) => r.id),
      {
        type: notificationService.NOTIFICATION_TYPES.REIMBURSEMENT_SUBMITTED,
        title: "New reimbursement claim",
        message: `${claimantName} submitted a reimbursement claim for ${formatMoney(claim.amount)} - ${claim.subject}.`,
      }
    );
  } catch (err) {
    console.error("Failed to create reimbursement submitted notification:", err);
  }

  for (const recipient of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendReimbursementSubmittedEmail({
        to: recipient.email,
        recipientFirstName: recipient.firstName,
        claimantName,
        subject: claim.subject,
        description: claim.description,
        amount: formatMoney(claim.amount),
        fileCount: claim.attachments.length,
      });
    } catch (err) {
      console.error("Failed to send reimbursement submitted email:", err);
    }
  }
};

// Manager/admin logs a claim directly for someone - recorded auto-approved.
const logClaimForEmployee = async ({ employee, actor, subject, description, amount, files, loggedByAdmin }) => {
  if (!files || files.length === 0) {
    throw ApiError.badRequest("Please attach at least one supporting file.");
  }

  const attachments = await uploadAttachments(files);

  const claim = await prisma.reimbursement.create({
    data: {
      userId: employee.id,
      routedToId: actor.id,
      approvedById: actor.id,
      subject,
      description,
      amount,
      status: "APPROVED",
      approvedAt: new Date(),
      createdByManager: true,
      createdByAdmin: Boolean(loggedByAdmin),
      attachments: { create: attachments },
    },
    include: CLAIM_INCLUDE,
  });

  return claim;
};

const sendLoggedSideEffects = async ({ claim, employee, actor }) => {
  const actorName = `${actor.firstName} ${actor.lastName}`;
  try {
    await notificationService.notify({
      userId: employee.id,
      type: notificationService.NOTIFICATION_TYPES.REIMBURSEMENT_DECIDED,
      title: "Reimbursement claim logged for you",
      message: `${actorName} logged and approved a reimbursement claim on your behalf for ${formatMoney(claim.amount)} - ${claim.subject}.`,
    });
  } catch (err) {
    console.error("Failed to create logged-reimbursement notification:", err);
  }

  try {
    await sendReimbursementLoggedEmail({
      to: employee.email,
      employeeFirstName: employee.firstName,
      actorName,
      subject: claim.subject,
      amount: formatMoney(claim.amount),
    });
  } catch (err) {
    console.error("Failed to send logged-reimbursement email:", err);
  }
};

// Shared approve/reject. Caller has already loaded the claim and checked the
// actor is allowed to act on it (routed manager, or any admin) and is not the
// claimant. Rejection requires a reason.
const applyDecision = async ({ claim, actor, decision, remarks }) => {
  if (claim.status !== "PENDING") {
    throw ApiError.badRequest("This claim has already been actioned.");
  }
  if (decision === "REJECTED" && !remarks?.trim()) {
    throw ApiError.badRequest("Please give a reason for rejecting this claim.");
  }

  return prisma.reimbursement.update({
    where: { id: claim.id },
    data:
      decision === "APPROVED"
        ? { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), managerRemarks: remarks?.trim() || null }
        : { status: "REJECTED", approvedById: actor.id, rejectedAt: new Date(), managerRemarks: remarks.trim() },
    include: CLAIM_INCLUDE,
  });
};

const sendDecisionSideEffects = async ({ claim, actor, decision, remarks }) => {
  const actorName = `${actor.firstName} ${actor.lastName}`;
  const verb = decision === "APPROVED" ? "approved" : "rejected";

  try {
    await notificationService.notify({
      userId: claim.userId,
      type: notificationService.NOTIFICATION_TYPES.REIMBURSEMENT_DECIDED,
      title: `Reimbursement claim ${verb}`,
      message: `Your reimbursement claim (${claim.subject}, ${formatMoney(claim.amount)}) was ${verb} by ${actorName}.${
        decision === "REJECTED" && remarks ? ` Reason: ${remarks.trim()}` : ""
      }`,
    });
  } catch (err) {
    console.error(`Failed to create reimbursement ${verb} notification:`, err);
  }

  try {
    await sendReimbursementDecisionEmail({
      to: claim.user.email,
      employeeFirstName: claim.user.firstName,
      subject: claim.subject,
      amount: formatMoney(claim.amount),
      status: decision,
      decidedByName: actorName,
      remarks: remarks?.trim() || null,
    });
  } catch (err) {
    console.error(`Failed to send reimbursement ${verb} email:`, err);
  }
};

module.exports = {
  CLAIM_INCLUDE,
  formatMoney,
  getNoticeRecipients,
  createOwnClaim,
  sendSubmitSideEffects,
  logClaimForEmployee,
  sendLoggedSideEffects,
  applyDecision,
  sendDecisionSideEffects,
};
