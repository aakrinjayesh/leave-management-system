require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  FORCEHEAD_URL: process.env.FORCEHEAD_URL,

  DATABASE_URL: process.env.DATABASE_URL,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN_DAYS:
    Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS) || 7,
  JWT_OTP_FLOW_SECRET: process.env.JWT_OTP_FLOW_SECRET,

  OTP_LENGTH: Number(process.env.OTP_LENGTH) || 6,
  OTP_EXPIRES_IN_MINUTES: Number(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  OTP_RESEND_COOLDOWN_SECONDS:
    Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 30,

  EMPLOYEE_EMAIL_DOMAIN: (
    process.env.EMPLOYEE_EMAIL_DOMAIN || "aakrin.com"
  ).toLowerCase(),

  EMAIL_SENDEREMAIL: process.env.EMAIL_SENDEREMAIL,
  EMAIL_SENDERPASS: process.env.EMAIL_SENDERPASS,
  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_SECURE: process.env.EMAIL_SECURE,

  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
};

const requiredInProduction = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_OTP_FLOW_SECRET",
  "DATABASE_URL",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_BUCKET_NAME",
];

for (const key of requiredInProduction) {
  if (!env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = env;
