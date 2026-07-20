const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAccessToken } = require("../utils/token.util");
const prisma = require("../config/prisma");

// Verifies the access token and attaches the current user to req.user.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    throw ApiError.unauthorized("You must be logged in to do this.");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized("Your session has expired. Please log in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });

  if (!user || user.status !== "ACTIVE") {
    throw ApiError.unauthorized("Your session is no longer valid. Please log in again.");
  }

  // isManager is derived, not stored: true whenever at least one other user has
  // picked this account as their manager (see profile.controller.js).
  const directReportsCount = await prisma.user.count({ where: { managerId: user.id } });

  req.user = { ...user, isManager: directReportsCount > 0 };
  next();
});

// Restricts a route to specific user types. Use after authenticate.
const authorize = (...allowedTypes) => (req, res, next) => {
  if (!req.user || !allowedTypes.includes(req.user.userType)) {
    throw ApiError.forbidden("You don't have permission to do this.");
  }
  next();
};

// Restricts a route to accounts that currently have at least one direct report
// (anyone who set this account as their manager) - independent of userType.
const authorizeManager = (req, res, next) => {
  if (!req.user || !req.user.isManager) {
    throw ApiError.forbidden("You don't have permission to do this.");
  }
  next();
};

module.exports = { authenticate, authorize, authorizeManager };
