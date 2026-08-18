const prisma = require("../config/prisma");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { hashPassword, comparePassword } = require("../utils/password.util");
const { REFRESH_TOKEN_COOKIE, OTP_PURPOSE, USER_TYPE, USER_STATUS, RESIGNATION_STATUS } = require("../utils/constants");
const { isEmployeeDomainEmail } = require("../utils/emailDomain.util");
const otpService = require("../services/otp.service");
const tokenService = require("../services/token.service");
const payrollService = require("../services/payroll.service");
const notificationService = require("../services/notification.service");
const { sendAccountApprovalRequestedEmail } = require("../utils/email.util");

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
};

// Shows only the last 4 characters of a sensitive value (bank account, PAN,
// UAN) on a user's own profile - full value is admin-view only.
const maskTail = (value) => {
  if (!value) return value;
  const tail = value.slice(-4);
  return `${"*".repeat(Math.max(value.length - 4, 0))}${tail}`;
};

// isManager and manager are derived at read time rather than stored, so they
// always reflect the current org chart even as managerId assignments change.
const toSafeUser = async (user) => {
  const now = new Date();
  const [manager, directReportsCount, customFields, salaryStructure, salaryStructureHistory, acceptedResignation] =
    await Promise.all([
      user.managerId
        ? prisma.user.findUnique({
            where: { id: user.managerId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : null,
      prisma.user.count({ where: { managerId: user.id } }),
      prisma.employeeCustomField.findMany({
        where: { userId: user.id },
        select: { id: true, label: true, value: true },
        orderBy: { createdAt: "asc" },
      }),
      // Whatever salary structure is currently in effect for this employee -
      // lets their own Profile page show exactly what admin has fixed for them.
      payrollService.getEffectiveSalaryConfig(user.id, now.getFullYear(), now.getMonth() + 1),
      // Every past entry too, so the employee can see how their structure changed over time.
      payrollService.getSalaryStructureHistory(user.id),
      // Once accepted, the employee is on their way out - blocks new leave
      // requests (see employeeLeave.controller.js's applyLeave), and lets the
      // frontend hide the "Apply for leave" button instead of just erroring.
      prisma.resignation.findFirst({ where: { userId: user.id, status: RESIGNATION_STATUS.ACCEPTED } }),
    ]);

  return {
    id: user.id,
    employeeCode: user.employeeCode,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate,
    joiningDate: user.joiningDate,
    lastAnniversaryCelebratedYears: user.lastAnniversaryCelebratedYears,
    lastBirthdayCelebratedYear: user.lastBirthdayCelebratedYear,
    gender: user.gender,
    fatherName: user.fatherName,
    spouseName: user.spouseName,
    maritalStatus: user.maritalStatus,
    nationality: user.nationality,
    qualification: user.qualification,
    designation: user.designation,
    location: user.location,
    // Photo itself is only ever streamed through the authenticated
    // /profile/photo endpoint (no public URL exists) - this just tells the
    // frontend whether it's worth fetching at all.
    hasPhoto: Boolean(user.photoUrl),
    taxRegime: user.taxRegime,
    pan: maskTail(user.pan),
    panHolderName: user.panHolderName,
    uan: maskTail(user.uan),
    aadharNumber: maskTail(user.aadharNumber),
    aadharHolderName: user.aadharHolderName,
    bankAccountNumber: maskTail(user.bankAccountNumber),
    bankName: user.bankName,
    ifscCode: user.ifscCode,
    pfNumber: user.pfNumber,
    salaryCtc: user.salaryCtc,
    salaryStructure: salaryStructure
      ? {
          id: salaryStructure.id,
          ctc: salaryStructure.ctc,
          effectiveFrom: salaryStructure.effectiveFrom,
          basicPercentOfCtc: salaryStructure.basicPercentOfCtc,
          hraPercentOfBasic: salaryStructure.hraPercentOfBasic,
          ltaPercentOfBasic: salaryStructure.ltaPercentOfBasic,
          guaranteedAllowancePercentOfBasic: salaryStructure.guaranteedAllowancePercentOfBasic,
          conveyanceMonthly: salaryStructure.conveyanceMonthly,
          pfMonthlyAmount: salaryStructure.pfMonthlyAmount,
          professionalTax: salaryStructure.professionalTax,
          professionalTaxThreshold: salaryStructure.professionalTaxThreshold,
        }
      : null,
    // Every earlier entry, excluding whichever one is "current" above - lets
    // the employee's Profile page show how their structure changed over time.
    pastSalaryStructures: salaryStructureHistory
      .filter((entry) => entry.id !== salaryStructure?.id)
      .map((entry) => ({
        id: entry.id,
        ctc: entry.ctc,
        effectiveFrom: entry.effectiveFrom,
        basicPercentOfCtc: entry.basicPercentOfCtc,
        hraPercentOfBasic: entry.hraPercentOfBasic,
        ltaPercentOfBasic: entry.ltaPercentOfBasic,
        guaranteedAllowancePercentOfBasic: entry.guaranteedAllowancePercentOfBasic,
        conveyanceMonthly: entry.conveyanceMonthly,
        pfMonthlyAmount: entry.pfMonthlyAmount,
        professionalTax: entry.professionalTax,
        professionalTaxThreshold: entry.professionalTaxThreshold,
      })),
    customFields,
    userType: user.userType,
    status: user.status,
    managerId: user.managerId,
    manager,
    isManager: directReportsCount > 0,
    hasAcceptedResignation: Boolean(acceptedResignation),
  };
};

const setRefreshCookie = (res, rawRefreshToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE, rawRefreshToken, REFRESH_COOKIE_OPTIONS);
};

// ---------- Account activation & self-registration ----------
// This single flow serves two cases:
//  - Activating a pre-created account (Team Lead / HR / Manager / Admin, added by an admin):
//    the row already exists, firstName/lastName are ignored if sent.
//  - Self-registration (employees only): if no row exists for this email yet, one is
//    created here as EMPLOYEE, gated by the @aakrin.com domain check.

const activateSendOtp = asyncHandler(async (req, res) => {
  const { email, firstName, lastName } = req.body;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user && user.isPasswordSet && user.status === USER_STATUS.ACTIVE) {
    throw ApiError.badRequest("This account is already activated. Please log in instead.");
  }

  if (!user) {
    if (!isEmployeeDomainEmail(email)) {
      throw ApiError.badRequest(
        `New accounts must use an @${env.EMPLOYEE_EMAIL_DOMAIN} email. Contact your administrator for any other type of account.`
      );
    }
    if (!firstName || !lastName) {
      throw ApiError.badRequest("Please provide your first and last name to create an account.");
    }
    user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        userType: USER_TYPE.EMPLOYEE,
        status: USER_STATUS.PENDING,
        isPasswordSet: false,
      },
    });
  }

  const { flowToken } = await otpService.createAndSendOtp(user, OTP_PURPOSE.REGISTER);

  new ApiResponse(200, "We've sent a verification code to your email.", { flowToken }).send(res);
});

const activateVerifyOtp = asyncHandler(async (req, res) => {
  const { flowToken, otp } = req.body;

  const { user } = await otpService.verifyOtp(flowToken, otp, OTP_PURPOSE.REGISTER);

  const verifiedToken = otpService.signVerifiedFlowToken(user.id, OTP_PURPOSE.REGISTER);

  new ApiResponse(200, "Email verified. Please set your password.", {
    flowToken: verifiedToken,
  }).send(res);
});

const activateSetPassword = asyncHandler(async (req, res) => {
  const { flowToken, password } = req.body;

  const payload = otpService.requireVerifiedFlowToken(flowToken, OTP_PURPOSE.REGISTER);

  const passwordHash = await hashPassword(password);

  // Password set doesn't activate the account by itself anymore - it goes
  // back to (or stays) PENDING, now meaning "awaiting admin approval" rather
  // than "not yet activated" (isPasswordSet distinguishes the two - see
  // login below). A previously REJECTED account resubmits into the same
  // PENDING state so it shows back up for admin to review.
  const user = await prisma.user.update({
    where: { id: payload.userId },
    data: {
      password: passwordHash,
      isPasswordSet: true,
      status: USER_STATUS.PENDING,
    },
  });

  new ApiResponse(
    200,
    "Your details are submitted. An admin needs to approve your account before you can log in - you'll be notified once that happens.",
    { email: user.email }
  ).send(res);

  // Sent after the response so the employee doesn't wait on it; failures
  // here shouldn't fail account activation itself.
  try {
    const admins = await prisma.user.findMany({ where: { userType: USER_TYPE.ADMIN, status: USER_STATUS.ACTIVE } });
    const employeeName = `${user.firstName} ${user.lastName}`;

    await notificationService.notifyMany(
      admins.map((a) => a.id),
      {
        type: notificationService.NOTIFICATION_TYPES.ACCOUNT_APPROVAL_REQUESTED,
        title: "New account awaiting approval",
        message: `${employeeName} (${user.email}) has finished setting up their account and needs your approval before they can log in.`,
      }
    );

    for (const admin of admins) {
      try {
        await sendAccountApprovalRequestedEmail({
          to: admin.email,
          adminFirstName: admin.firstName,
          employeeName,
          employeeEmail: user.email,
        });
      } catch (err) {
        console.error(`Failed to send account approval requested email to ${admin.email}:`, err);
      }
    }
  } catch (err) {
    console.error("Failed to notify admins of new account approval request:", err);
  }
});

// ---------- Login (email + password, or email + OTP) ----------
// There's no client-declared role anymore - the backend looks the account up by
// email and reads its real userType/domain rules from the database.

const findLoginableUser = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || (user.userType === USER_TYPE.EMPLOYEE && !isEmployeeDomainEmail(user.email))) {
    return null;
  }

  return user;
};

// Distinguishes every reason a not-yet-loggable-in account can be in that
// state, since "isn't activated yet" stopped being the only possibility once
// admin approval was added as a separate step after activation.
const assertCanLogIn = (user) => {
  if (user.status === USER_STATUS.ACTIVE && user.isPasswordSet) return;

  if (!user.isPasswordSet) {
    throw ApiError.forbidden("Your account isn't activated yet. Please activate it first.");
  }
  if (user.status === USER_STATUS.PENDING) {
    throw ApiError.forbidden("Your account is awaiting admin approval. You'll be notified once it's approved.");
  }
  if (user.status === USER_STATUS.REJECTED) {
    throw ApiError.forbidden("Your account request wasn't approved. Please contact your administrator.");
  }
  throw ApiError.forbidden("Your account is inactive. Please contact your administrator.");
};

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await findLoginableUser(email);
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  assertCanLogIn(user);

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized("Invalid email or password.");
  }

  const { accessToken, rawRefreshToken } = await tokenService.issueAuthTokens(user, req);
  setRefreshCookie(res, rawRefreshToken);

  new ApiResponse(200, "Logged in successfully.", {
    accessToken,
    user: await toSafeUser(user),
  }).send(res);
});

const loginOtpSend = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await findLoginableUser(email);
  if (!user) {
    throw ApiError.unauthorized("We couldn't find an account with this email.");
  }

  assertCanLogIn(user);

  const { flowToken } = await otpService.createAndSendOtp(user, OTP_PURPOSE.LOGIN);

  new ApiResponse(200, "We've sent a verification code to your email.", { flowToken }).send(res);
});

const loginOtpVerify = asyncHandler(async (req, res) => {
  const { flowToken, otp } = req.body;

  const { user } = await otpService.verifyOtp(flowToken, otp, OTP_PURPOSE.LOGIN);

  const { accessToken, rawRefreshToken } = await tokenService.issueAuthTokens(user, req);
  setRefreshCookie(res, rawRefreshToken);

  new ApiResponse(200, "Logged in successfully.", {
    accessToken,
    user: await toSafeUser(user),
  }).send(res);
});

// ---------- Shared OTP resend (works for any in-progress flow) ----------

const resendOtp = asyncHandler(async (req, res) => {
  const { flowToken } = req.body;

  const payload = otpService.decodeFlowToken(flowToken);

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw ApiError.unauthorized("This session has expired. Please start again.");
  }

  const { flowToken: newFlowToken } = await otpService.createAndSendOtp(user, payload.purpose);

  new ApiResponse(200, "A new code has been sent to your email.", { flowToken: newFlowToken }).send(res);
});

// ---------- Forgot / reset password ----------

const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isPasswordSet) {
    throw ApiError.notFound("No activated account found with this email.");
  }

  const { flowToken } = await otpService.createAndSendOtp(user, OTP_PURPOSE.FORGOT_PASSWORD);

  new ApiResponse(200, "We've sent a verification code to your email.", { flowToken }).send(res);
});

const forgotPasswordVerifyOtp = asyncHandler(async (req, res) => {
  const { flowToken, otp } = req.body;

  const { user } = await otpService.verifyOtp(flowToken, otp, OTP_PURPOSE.FORGOT_PASSWORD);

  const verifiedToken = otpService.signVerifiedFlowToken(user.id, OTP_PURPOSE.FORGOT_PASSWORD);

  new ApiResponse(200, "Code verified. Please set a new password.", {
    flowToken: verifiedToken,
  }).send(res);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { flowToken, password } = req.body;

  const payload = otpService.requireVerifiedFlowToken(flowToken, OTP_PURPOSE.FORGOT_PASSWORD);

  const passwordHash = await hashPassword(password);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { password: passwordHash },
  });

  // A password reset invalidates every existing session for this account.
  await tokenService.revokeAllUserRefreshTokens(payload.userId);

  new ApiResponse(200, "Your password has been reset. You can now log in.").send(res);
});

// ---------- Session ----------

const refreshToken = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!rawRefreshToken) {
    throw ApiError.unauthorized("Please log in again.");
  }

  const tokenRecord = await tokenService.findActiveRefreshToken(rawRefreshToken);
  if (!tokenRecord) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
    throw ApiError.unauthorized("Your session has expired. Please log in again.");
  }

  const user = await prisma.user.findUnique({ where: { id: tokenRecord.userId } });
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.unauthorized("Your session is no longer valid. Please log in again.");
  }

  const { accessToken, rawRefreshToken: newRawRefreshToken } = await tokenService.rotateRefreshToken(
    tokenRecord,
    user,
    req
  );
  setRefreshCookie(res, newRawRefreshToken);

  new ApiResponse(200, "Session refreshed.", { accessToken, user: await toSafeUser(user) }).send(res);
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (rawRefreshToken) {
    await tokenService.revokeRefreshToken(rawRefreshToken);
  }

  res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_COOKIE_OPTIONS);
  new ApiResponse(200, "Logged out successfully.").send(res);
});

const getMe = asyncHandler(async (req, res) => {
  new ApiResponse(200, "OK", { user: await toSafeUser(req.user) }).send(res);
});

module.exports = {
  activateSendOtp,
  activateVerifyOtp,
  activateSetPassword,
  login,
  loginOtpSend,
  loginOtpVerify,
  resendOtp,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  resetPassword,
  refreshToken,
  logout,
  getMe,
};
