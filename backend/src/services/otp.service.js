const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const { generateOtp, hashOtp, compareOtp, getOtpExpiry } = require("../utils/otp.util");
const { signOtpFlowToken, verifyOtpFlowToken } = require("../utils/token.util");
const { sendOtpEmail } = require("../utils/email.util");

// Creates a fresh OTP for a user + purpose, emails it, and returns a signed
// flow token that binds the following verify-otp request to this exact OTP record.
const createAndSendOtp = async (user, purpose) => {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  const otpRecord = await prisma.oTP.create({
    data: {
      userId: user.id,
      otp: otpHash,
      purpose,
      expiresAt: getOtpExpiry(),
    },
  });

  await sendOtpEmail({
    to: user.email,
    firstName: user.firstName,
    purpose,
    otp,
    minutes: env.OTP_EXPIRES_IN_MINUTES,
  });

  const flowToken = signOtpFlowToken({
    otpId: otpRecord.id,
    userId: user.id,
    purpose,
    stage: "otp_sent",
  });

  return { flowToken, otpRecord };
};

const decodeFlowToken = (flowToken, expectedPurpose, expectedStage) => {
  let payload;
  try {
    payload = verifyOtpFlowToken(flowToken);
  } catch {
    throw ApiError.unauthorized("This session has expired. Please start again.");
  }

  if (payload.purpose !== expectedPurpose) {
    throw ApiError.badRequest("Invalid session for this action.");
  }

  if (expectedStage && payload.stage !== expectedStage) {
    throw ApiError.badRequest("Invalid session for this action.");
  }

  return payload;
};

// Verifies the OTP tied to a flow token. On success, marks the OTP used and
// returns the user record so the caller can decide what happens next.
const verifyOtp = async (flowToken, submittedOtp, expectedPurpose) => {
  const payload = decodeFlowToken(flowToken, expectedPurpose, "otp_sent");

  const otpRecord = await prisma.oTP.findUnique({ where: { id: payload.otpId } });

  if (!otpRecord || otpRecord.userId !== payload.userId) {
    throw ApiError.unauthorized("This session has expired. Please start again.");
  }

  if (otpRecord.usedAt) {
    throw ApiError.badRequest("This code has already been used. Please request a new one.");
  }

  if (otpRecord.expiresAt < new Date()) {
    throw ApiError.badRequest("This code has expired. Please request a new one.");
  }

  if (otpRecord.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw ApiError.tooManyRequests("Too many incorrect attempts. Please request a new code.");
  }

  const isMatch = await compareOtp(submittedOtp, otpRecord.otp);

  if (!isMatch) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    throw ApiError.badRequest("Incorrect code. Please try again.");
  }

  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { isVerified: true, usedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw ApiError.unauthorized("This session has expired. Please start again.");
  }

  return { user, otpRecord };
};

// Issues an escalated flow token proving the OTP step is complete, for flows
// that need one more step (set password / reset password) without re-verifying.
const signVerifiedFlowToken = (userId, purpose) =>
  signOtpFlowToken({ userId, purpose, stage: "otp_verified" });

const requireVerifiedFlowToken = (flowToken, expectedPurpose) =>
  decodeFlowToken(flowToken, expectedPurpose, "otp_verified");

module.exports = {
  createAndSendOtp,
  verifyOtp,
  decodeFlowToken,
  signVerifiedFlowToken,
  requireVerifiedFlowToken,
};
