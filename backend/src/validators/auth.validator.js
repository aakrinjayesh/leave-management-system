const { z } = require("zod");
const { OTP_PURPOSE } = require("../utils/constants");

const email = z.string().trim().toLowerCase().email("Please enter a valid email address.");

const otpCode = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.");

const flowToken = z.string().min(1, "Session expired. Please start again.");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const withConfirmPassword = (shape) =>
  z
    .object({ ...shape, confirmPassword: z.string() })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required."),
});

const loginOtpSendSchema = z.object({
  email,
});

const verifyOtpSchema = z.object({
  flowToken,
  otp: otpCode,
});

const resendOtpSchema = z.object({
  flowToken,
});

// Doubles as "activate a pre-created account" (firstName/lastName ignored if the
// email already exists) and "self-register" (firstName/lastName required when
// the email doesn't exist yet, and a new EMPLOYEE account is created on the fly).
const activateSendOtpSchema = z.object({
  email,
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
});

const activateSetPasswordSchema = withConfirmPassword({
  flowToken,
  password,
});

const forgotPasswordSendOtpSchema = z.object({
  email,
});

const resetPasswordSchema = withConfirmPassword({
  flowToken,
  password,
});

module.exports = {
  loginSchema,
  loginOtpSendSchema,
  verifyOtpSchema,
  resendOtpSchema,
  activateSendOtpSchema,
  activateSetPasswordSchema,
  forgotPasswordSendOtpSchema,
  resetPasswordSchema,
  OTP_PURPOSE,
};
