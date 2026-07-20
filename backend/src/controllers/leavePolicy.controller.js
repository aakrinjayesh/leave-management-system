const prisma = require("../config/prisma");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const listLeavePolicies = asyncHandler(async (req, res) => {
  const policies = await prisma.leavePolicy.findMany({
    where: { isActive: true },
    orderBy: { leaveName: "asc" },
  });

  new ApiResponse(200, "OK", { policies }).send(res);
});

module.exports = { listLeavePolicies };
