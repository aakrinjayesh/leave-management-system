const express = require("express");
const validate = require("../middlewares/validate.middleware");
const { authenticate } = require("../middlewares/auth.middleware");
const { authLimiter, otpVerifyLimiter } = require("../middlewares/rateLimiter.middleware");
const controller = require("../controllers/auth.controller");
const {
  loginSchema,
  loginOtpSendSchema,
  verifyOtpSchema,
  resendOtpSchema,
  activateSendOtpSchema,
  activateSetPasswordSchema,
  forgotPasswordSendOtpSchema,
  resetPasswordSchema,
} = require("../validators/auth.validator");

const router = express.Router();

router.post("/activate/send-otp", authLimiter, validate(activateSendOtpSchema), controller.activateSendOtp);
router.post("/activate/verify-otp", otpVerifyLimiter, validate(verifyOtpSchema), controller.activateVerifyOtp);
router.post("/activate/set-password", validate(activateSetPasswordSchema), controller.activateSetPassword);

router.post("/login", authLimiter, validate(loginSchema), controller.login);
router.post("/login/otp/send", authLimiter, validate(loginOtpSendSchema), controller.loginOtpSend);
router.post("/login/otp/verify", otpVerifyLimiter, validate(verifyOtpSchema), controller.loginOtpVerify);

router.post("/otp/resend", authLimiter, validate(resendOtpSchema), controller.resendOtp);

router.post(
  "/forgot-password/send-otp",
  authLimiter,
  validate(forgotPasswordSendOtpSchema),
  controller.forgotPasswordSendOtp
);
router.post(
  "/forgot-password/verify-otp",
  otpVerifyLimiter,
  validate(verifyOtpSchema),
  controller.forgotPasswordVerifyOtp
);
router.post("/reset-password", validate(resetPasswordSchema), controller.resetPassword);

router.post("/refresh-token", controller.refreshToken);
router.post("/logout", controller.logout);
router.get("/me", authenticate, controller.getMe);

module.exports = router;
