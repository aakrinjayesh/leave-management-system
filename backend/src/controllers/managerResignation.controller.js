const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const resignationService = require("../services/resignation.service");

// View only - a manager can see resignations from their direct reports but
// has no Accept/Reject action; only admin decides.
const listTeamResignations = asyncHandler(async (req, res) => {
  const resignations = await resignationService.listForManager(req.user.id);

  new ApiResponse(200, "OK", { resignations }).send(res);
});

module.exports = { listTeamResignations };
