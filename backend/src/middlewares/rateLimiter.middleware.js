const rateLimit = require("express-rate-limit");

const jsonHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many attempts. Please wait a moment and try again.",
  });
};

// Applies to password-check + OTP-send endpoints to slow down brute force / spam.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

// Tighter limit specifically for OTP verification attempts.
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonHandler,
});

module.exports = { authLimiter, otpVerifyLimiter };
