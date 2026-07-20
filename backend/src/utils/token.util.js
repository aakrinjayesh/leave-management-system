const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

const signAccessToken = (user) =>
  jwt.sign(
    { sub: user.id, userType: user.userType, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

const generateRawRefreshToken = () => crypto.randomBytes(64).toString("hex");

const hashRefreshToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const getRefreshTokenExpiry = () =>
  new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

// Short-lived token that carries an in-progress OTP flow (login 2FA, activation, forgot password)
// between requests, without needing server-side session storage.
const signOtpFlowToken = (payload) =>
  jwt.sign(payload, env.JWT_OTP_FLOW_SECRET, {
    expiresIn: `${env.OTP_EXPIRES_IN_MINUTES}m`,
  });

const verifyOtpFlowToken = (token) => jwt.verify(token, env.JWT_OTP_FLOW_SECRET);

module.exports = {
  signAccessToken,
  verifyAccessToken,
  generateRawRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  signOtpFlowToken,
  verifyOtpFlowToken,
};
