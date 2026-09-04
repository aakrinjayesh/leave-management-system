const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const wfhService = require("../services/wfh.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Notification goes to both the employee and their manager (view-only on
// WFH requests, same as resignations) - admin is the only one who decides.
const DECISION_TITLE = {
  APPROVED: "WFH request approved",
  REJECTED: "WFH request rejected",
  CANCELLED: "WFH approval revoked",
};

const notifyDecision = async (request, status, message) => {
  try {
    const recipientIds = new Set([request.user.id]);
    if (request.user.managerId) {
      const manager = await prisma.user.findFirst({ where: { id: request.user.managerId, status: "ACTIVE" } });
      if (manager) recipientIds.add(manager.id);
    }

    await notificationService.notifyMany([...recipientIds], {
      type: notificationService.NOTIFICATION_TYPES.WFH_DECIDED,
      title: DECISION_TITLE[status] || "WFH request updated",
      message,
    });
  } catch (err) {
    console.error(`Failed to create WFH ${status.toLowerCase()} notification:`, err);
  }
};

const listWfhRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const today = startOfUtcDay(new Date());

  const [requests, todayCount] = await Promise.all([
    wfhService.listForAdmin(status || undefined),
    // Company-wide, regardless of the status filter above - a quick "how many
    // people are WFH right now" count for the page header.
    prisma.wfhRequest.count({
      where: { status: "APPROVED", startDate: { lte: today }, endDate: { gte: today } },
    }),
  ]);

  new ApiResponse(200, "OK", { requests, todayCount }).send(res);
});

const approveWfhRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const request = await wfhService.approveWfhRequest(id, req.user.id);

  new ApiResponse(200, "WFH request approved.", { request }).send(res);

  const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
  await notifyDecision(
    request,
    "APPROVED",
    `${request.user.firstName} ${request.user.lastName}'s WFH request (${formatDateShort(
      request.startDate
    )} - ${formatDateShort(request.endDate)}) was approved by ${decidedByName}.`
  );
});

const rejectWfhRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const request = await wfhService.rejectWfhRequest(id, req.user.id, remarks);

  new ApiResponse(200, "WFH request rejected.", { request }).send(res);

  const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
  await notifyDecision(
    request,
    "REJECTED",
    `${request.user.firstName} ${request.user.lastName}'s WFH request (${formatDateShort(
      request.startDate
    )} - ${formatDateShort(request.endDate)}) was rejected by ${decidedByName}.`
  );
});

const revokeWfhRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { remarks } = req.body;

  const request = await wfhService.revokeApprovedWfhRequest(id, req.user.id, remarks);

  new ApiResponse(200, "WFH approval revoked.", { request }).send(res);

  const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
  await notifyDecision(
    request,
    "CANCELLED",
    `${request.user.firstName} ${request.user.lastName}'s approved WFH request (${formatDateShort(
      request.startDate
    )} - ${formatDateShort(request.endDate)}) was revoked by ${decidedByName}.`
  );
});

module.exports = { listWfhRequests, approveWfhRequest, rejectWfhRequest, revokeWfhRequest };
