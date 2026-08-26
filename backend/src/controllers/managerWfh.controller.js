const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const wfhService = require("../services/wfh.service");

// View only - a manager can see WFH requests from their direct reports but
// has no Approve/Reject action; only admin decides.
const listTeamWfhRequests = asyncHandler(async (req, res) => {
  const requests = await wfhService.listForManager(req.user.id);

  new ApiResponse(200, "OK", { requests }).send(res);
});

module.exports = { listTeamWfhRequests };
