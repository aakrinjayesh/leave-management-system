const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const resignationService = require("../services/resignation.service");
const { sendResignationDecisionEmail } = require("../utils/email.util");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

// Notification goes to both the employee and their manager (view-only on
// resignations); the email above stays employee-only.
const notifyDecision = async (resignation, status, message) => {
  try {
    const recipientIds = new Set([resignation.user.id]);
    if (resignation.user.managerId) {
      const manager = await prisma.user.findFirst({ where: { id: resignation.user.managerId, status: "ACTIVE" } });
      if (manager) recipientIds.add(manager.id);
    }

    await notificationService.notifyMany([...recipientIds], {
      type: notificationService.NOTIFICATION_TYPES.RESIGNATION_DECIDED,
      title: status === "ACCEPTED" ? "Resignation accepted" : "Resignation rejected",
      message,
    });
  } catch (err) {
    console.error(`Failed to create resignation ${status.toLowerCase()} notification:`, err);
  }
};

const listResignations = asyncHandler(async (req, res) => {
  const resignations = await resignationService.listForAdmin();

  new ApiResponse(200, "OK", { resignations }).send(res);
});

const acceptResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.acceptResignation(id, req.user.id);

  new ApiResponse(200, "Resignation accepted.", { resignation }).send(res);

  // Sent after the response so the admin doesn't wait on the email round-trip.
  try {
    await sendResignationDecisionEmail({
      to: resignation.user.email,
      employeeFirstName: resignation.user.firstName,
      status: "ACCEPTED",
      lastWorkingDate: resignation.lastWorkingDate,
      decidedByName: `${req.user.firstName} ${req.user.lastName}`,
    });
  } catch (err) {
    console.error("Failed to send resignation accepted email:", err);
  }

  const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
  await notifyDecision(
    resignation,
    "ACCEPTED",
    `${resignation.user.firstName} ${resignation.user.lastName}'s resignation was accepted by ${decidedByName}. Confirmed last working day: ${formatDateShort(
      resignation.lastWorkingDate
    )}.`
  );
});

const rejectResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.rejectResignation(id, req.user.id);

  new ApiResponse(200, "Resignation rejected.", { resignation }).send(res);

  // Sent after the response so the admin doesn't wait on the email round-trip.
  try {
    await sendResignationDecisionEmail({
      to: resignation.user.email,
      employeeFirstName: resignation.user.firstName,
      status: "REJECTED",
      decidedByName: `${req.user.firstName} ${req.user.lastName}`,
    });
  } catch (err) {
    console.error("Failed to send resignation rejected email:", err);
  }

  const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
  await notifyDecision(
    resignation,
    "REJECTED",
    `${resignation.user.firstName} ${resignation.user.lastName}'s resignation was rejected by ${decidedByName}.`
  );
});

module.exports = { listResignations, acceptResignation, rejectResignation };
