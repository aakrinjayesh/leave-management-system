const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const resignationService = require("../services/resignation.service");
const { sendResignationDecisionEmail } = require("../utils/email.util");

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
});

module.exports = { listResignations, acceptResignation, rejectResignation };
