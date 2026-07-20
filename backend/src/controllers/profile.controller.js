const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const userManagerService = require("../services/userManager.service");

// Any active user can be picked as someone's manager - not just Manager/Admin
// tier accounts.
const getManagerOptions = asyncHandler(async (req, res) => {
  const options = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { not: req.user.id } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { firstName: "asc" },
  });

  new ApiResponse(200, "OK", { options }).send(res);
});

const updateMyManager = asyncHandler(async (req, res) => {
  const { managerId } = req.body;

  if (managerId === req.user.id) {
    throw ApiError.badRequest("You can't set yourself as your own manager.");
  }

  const manager = await prisma.user.findFirst({ where: { id: managerId, status: "ACTIVE" } });
  if (!manager) {
    throw ApiError.badRequest("Please choose a valid person as your manager.");
  }

  await userManagerService.setUserManager(req.user.id, managerId);

  new ApiResponse(200, "Manager updated.").send(res);
});

module.exports = { getManagerOptions, updateMyManager };
