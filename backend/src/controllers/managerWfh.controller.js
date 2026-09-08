const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const wfhService = require("../services/wfh.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { sendWfhDecisionEmail } = require("../utils/email.util");

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

const notifyDecision = async (request, status, message, decidedByName) => {
  // The employee, plus every active admin (company-wide WFH visibility).
  const recipientsById = new Map([[request.user.id, request.user]]);
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
    admins.forEach((a) => {
      if (!recipientsById.has(a.id)) recipientsById.set(a.id, a);
    });
  } catch (err) {
    console.error("Failed to load admins for WFH decision notice:", err);
  }
  const recipients = [...recipientsById.values()];

  try {
    await notificationService.notifyMany(
      recipients.map((r) => r.id),
      {
        type: notificationService.NOTIFICATION_TYPES.WFH_DECIDED,
        title: DECISION_TITLE[status] || "WFH request updated",
        message,
      }
    );
  } catch (err) {
    console.error(`Failed to create WFH ${status.toLowerCase()} notification:`, err);
  }

  const employeeName = `${request.user.firstName} ${request.user.lastName}`;
  for (const recipient of recipients) {
    try {
      await sendWfhDecisionEmail({
        to: recipient.email,
        recipientFirstName: recipient.firstName,
        employeeName,
        startDate: request.startDate,
        endDate: request.endDate,
        status,
        decidedByName,
        remarks: request.adminRemarks || null,
        isEmployee: recipient.id === request.user.id,
      });
    } catch (err) {
      console.error(`Failed to send WFH ${status.toLowerCase()} email:`, err);
    }
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
      )} - ${formatDateShort(request.endDate)}) was ${verb} by ${decidedByName}.`,
      decidedByName
    );
  });

const approveWfhRequest = decide("APPROVED");
const rejectWfhRequest = decide("REJECTED");

module.exports = { listTeamWfhRequests, approveWfhRequest, rejectWfhRequest };
