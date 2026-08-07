const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const resignationService = require("../services/resignation.service");

const listResignations = asyncHandler(async (req, res) => {
  const resignations = await resignationService.listForAdmin();

  new ApiResponse(200, "OK", { resignations }).send(res);
});

const acceptResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.acceptResignation(id, req.user.id);

  new ApiResponse(200, "Resignation accepted.", { resignation }).send(res);
});

const rejectResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.rejectResignation(id, req.user.id);

  new ApiResponse(200, "Resignation rejected.", { resignation }).send(res);
});

module.exports = { listResignations, acceptResignation, rejectResignation };
