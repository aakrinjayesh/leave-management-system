const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/prisma");
const tokenService = require("../services/token.service");
const { REFRESH_TOKEN_COOKIE } = require("../utils/constants");

// The browser's EventSource API can't send a custom Authorization header, so
// the SSE route authenticates off the existing refresh-token cookie instead
// (already httpOnly + same-origin, sent automatically) rather than the
// short-lived Bearer access token every other route requires. Read-only
// lookup - never rotates the refresh token, unlike the real /auth/refresh
// endpoint.
const authenticateViaRefreshCookie = asyncHandler(async (req, res, next) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (!rawRefreshToken) {
    throw ApiError.unauthorized("You must be logged in to do this.");
  }

  const tokenRecord = await tokenService.findActiveRefreshToken(rawRefreshToken);
  if (!tokenRecord) {
    throw ApiError.unauthorized("Your session has expired. Please log in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
  if (!user || user.status !== "ACTIVE") {
    throw ApiError.unauthorized("Your session is no longer valid. Please log in again.");
  }

  req.user = user;
  next();
});

module.exports = { authenticateViaRefreshCookie };
