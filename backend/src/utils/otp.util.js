const crypto = require("crypto");
const bcrypt = require("bcrypt");
const env = require("../config/env");

const OTP_SALT_ROUNDS = 10;

const generateOtp = () => {
  const max = 10 ** env.OTP_LENGTH;
  const value = crypto.randomInt(0, max);
  return String(value).padStart(env.OTP_LENGTH, "0");
};

const hashOtp = (otp) => bcrypt.hash(otp, OTP_SALT_ROUNDS);

const compareOtp = (otp, hash) => bcrypt.compare(otp, hash);

const getOtpExpiry = () => new Date(Date.now() + env.OTP_EXPIRES_IN_MINUTES * 60 * 1000);

module.exports = { generateOtp, hashOtp, compareOtp, getOtpExpiry };
