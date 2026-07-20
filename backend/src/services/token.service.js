const prisma = require("../config/prisma");
const {
  signAccessToken,
  generateRawRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
} = require("../utils/token.util");

// Issues a new access + refresh token pair for a user and persists the refresh
// token (hashed) so it can be revoked/rotated later.
const issueAuthTokens = async (user, req) => {
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateRawRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: hashRefreshToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
      deviceInfo: req.get("user-agent") || null,
      ipAddress: req.ip || null,
    },
  });

  return { accessToken, rawRefreshToken };
};

// Rotates a refresh token: revokes the old one and issues a brand new pair.
const rotateRefreshToken = async (oldTokenRecord, user, req) => {
  await prisma.refreshToken.update({
    where: { id: oldTokenRecord.id },
    data: { isRevoked: true },
  });

  return issueAuthTokens(user, req);
};

const findActiveRefreshToken = async (rawRefreshToken) => {
  const hashed = hashRefreshToken(rawRefreshToken);
  const record = await prisma.refreshToken.findUnique({ where: { token: hashed } });

  if (!record || record.isRevoked || record.expiresAt < new Date()) {
    return null;
  }

  return record;
};

const revokeRefreshToken = async (rawRefreshToken) => {
  const hashed = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { token: hashed },
    data: { isRevoked: true },
  });
};

const revokeAllUserRefreshTokens = async (userId) => {
  await prisma.refreshToken.updateMany({
    where: { userId, isRevoked: false },
    data: { isRevoked: true },
  });
};

module.exports = {
  issueAuthTokens,
  rotateRefreshToken,
  findActiveRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
};
