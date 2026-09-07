const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const wfhService = require("../services/wfh.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

// A manager sees WFH requests from their direct reports and - now that any
// account (admins included) can report to them - can approve or reject their
// own reports' requests. Company-wide WFH is still admin territory.
const listTeamWfhRequests = asyncHandler(async (req, res) => {
  const requests = await wfhService.listForManager(req.user.id);

  new ApiResponse(200, "OK", { requests }).send(res);
});

const DECISION_TITLE = {
  APPROVED: "WFH request approved",
  REJECTED: "WFH request rejected",
};

const notifyDecision = async (request, status, message) => {
  try {
    const recipientIds = new Set([request.user.id]);
    // Loop in every active admin too, so company-wide WFH visibility is kept.
    const admins = await prisma.user.findMany({
      where: { userType: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    admins.forEach((a) => recipientIds.add(a.id));

    await notificationService.notifyMany([...recipientIds], {
      type: notificationService.NOTIFICATION_TYPES.WFH_DECIDED,
      title: DECISION_TITLE[status] || "WFH request updated",
      message,
    });
  } catch (err) {
    console.error(`Failed to create WFH ${status.toLowerCase()} notification:`, err);
  }
};

const decide = (decision) =>
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const { remarks } = req.body;

    const request = await wfhService.decideWfhRequestByManager(id, req.user.id, decision, remarks);

    new ApiResponse(
      200,
      decision === "APPROVED" ? "WFH request approved." : "WFH request rejected.",
      { request }
    ).send(res);

    const decidedByName = `${req.user.firstName} ${req.user.lastName}`;
    const verb = decision === "APPROVED" ? "approved" : "rejected";
    await notifyDecision(
      request,
      decision,
      `${request.user.firstName} ${request.user.lastName}'s WFH request (${formatDateShort(
        request.startDate
      )} - ${formatDateShort(request.endDate)}) was ${verb} by ${decidedByName}.`
    );
  });

const approveWfhRequest = decide("APPROVED");
const rejectWfhRequest = decide("REJECTED");

module.exports = { listTeamWfhRequests, approveWfhRequest, rejectWfhRequest };
