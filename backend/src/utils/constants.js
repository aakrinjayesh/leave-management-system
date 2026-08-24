const REFRESH_TOKEN_COOKIE = "refreshToken";

const OTP_PURPOSE = {
  REGISTER: "REGISTER",
  LOGIN: "LOGIN",
  FORGOT_PASSWORD: "FORGOT_PASSWORD",
};

const USER_TYPE = {
  EMPLOYEE: "EMPLOYEE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
};

const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  REJECTED: "REJECTED",
};

const GENDER = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
};

const MARITAL_STATUS = {
  SINGLE: "SINGLE",
  MARRIED: "MARRIED",
  OTHER: "OTHER",
};

const TAX_REGIME = {
  OLD: "OLD",
  NEW: "NEW",
};

const RESIDENTIAL_STATUS = {
  RESIDENT: "RESIDENT",
  NON_RESIDENT: "NON_RESIDENT",
  RESIDENT_NOT_ORDINARILY_RESIDENT: "RESIDENT_NOT_ORDINARILY_RESIDENT",
};

// How many times an employee may use their own self-service profile edit
// form per section (Personal/Statutory/Bank Information) before only admin
// can change that section - see profile.controller.js's applySelfEdit.
const SELF_PROFILE_EDIT_LIMIT = 3;

const RESIGNATION_STATUS = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
};

module.exports = {
  REFRESH_TOKEN_COOKIE,
  OTP_PURPOSE,
  USER_TYPE,
  USER_STATUS,
  GENDER,
  MARITAL_STATUS,
  TAX_REGIME,
  RESIDENTIAL_STATUS,
  RESIGNATION_STATUS,
  SELF_PROFILE_EDIT_LIMIT,
};
