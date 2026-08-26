const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const wfhService = require("../services/wfh.service");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");

// Every active admin, plus this employee's own active manager if they have
// one - same recipient set resignation submissions use. The manager is
// notified for visibility only - they can't act on a WFH request, only
// admin can.
const getWfhNoticeRecipients = async (employee) => {
  const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
  const recipientsById = new Map(admins.map((admin) => [admin.id, admin]));

  if (employee.managerId) {
    const manager = await prisma.user.findFirst({ where: { id: employee.managerId, status: "ACTIVE" } });
    if (manager) recipientsById.set(manager.id, manager);
  }

  return [...recipientsById.values()];
};

const submitMyWfhRequest = asyncHandler(async (req, res) => {
  const request = await wfhService.submitWfhRequest(req.user.id, req.body);

  new ApiResponse(201, "WFH request submitted.", { request }).send(res);

  // Sent after the response so the employee doesn't wait on the
  // notification round-trip; failures here shouldn't fail the submission.
  const employeeName = `${req.user.firstName} ${req.user.lastName}`;
  try {
    const recipients = await getWfhNoticeRecipients(req.user);
    await notificationService.notifyMany(
      recipients.map((r) => r.id),
      {
        type: notificationService.NOTIFICATION_TYPES.WFH_SUBMITTED,
        title: "New WFH request",
        message: `${employeeName} requested to work from home from ${formatDateShort(
          request.startDate
        )} to ${formatDateShort(request.endDate)}.`,
      }
    );
  } catch (err) {
    console.error("Failed to create WFH submitted notification:", err);
  }
});

const getMyWfhRequests = asyncHandler(async (req, res) => {
  const requests = await wfhService.getMyWfhRequests(req.user.id);

  new ApiResponse(200, "OK", { requests }).send(res);
});

const withdrawMyWfhRequest = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const request = await wfhService.withdrawWfhRequest(req.user.id, id);

  new ApiResponse(200, "WFH request withdrawn.", { request }).send(res);
});

module.exports = { submitMyWfhRequest, getMyWfhRequests, withdrawMyWfhRequest };
