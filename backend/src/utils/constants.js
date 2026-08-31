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

// Fixed prompts for the private "Introduce yourself" card on the employee
// dashboard. The frontend has a matching list with the display labels; the
// keys here are the source of truth for what User.intro may contain.
const INTRO_PROMPT_KEYS = ["about", "jobLove", "outsideWork"];

const INTRO_ANSWER_MAX_LENGTH = 2000;

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
  INTRO_PROMPT_KEYS,
  INTRO_ANSWER_MAX_LENGTH,
};
