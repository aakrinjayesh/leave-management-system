const { z } = require("zod");
const { USER_TYPE, GENDER, MARITAL_STATUS, TAX_REGIME, RESIDENTIAL_STATUS } = require("../utils/constants");
const { isEmployeeDomainEmail } = require("../utils/emailDomain.util");
const env = require("../config/env");

// Every account an admin creates - Employee, Manager, or Admin - must stay
// on the company domain, same rule as self-registration.
const createUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .refine(isEmployeeDomainEmail, { message: `Please use an @${env.EMPLOYEE_EMAIL_DOMAIN} email.` }),
  userType: z.enum([USER_TYPE.EMPLOYEE, USER_TYPE.MANAGER, USER_TYPE.ADMIN]),
});

const updateManagerSchema = z.object({
  managerId: z.union([z.coerce.number().int().positive(), z.null()]),
});

const setAdminAccessSchema = z.object({
  grant: z.boolean(),
});

const nullableInt = (min = 0) => z.coerce.number().int().min(min).nullable().optional();

const createLeavePolicySchema = z.object({
  leaveName: z.string().trim().min(1, "Leave name is required.").max(100),
  allocatedLeaves: z.coerce.number().int().min(0),
  isUnlimited: z.boolean().optional(),
  isUnpaid: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  maxLeavesPerRequest: z.coerce.number().int().min(1),
  maxAdvanceBookingDays: nullableInt(),
  longRequestThresholdDays: nullableInt(),
  longRequestMinNoticeDays: nullableInt(),
  attachmentRequiredAboveDays: nullableInt(),
  maxLeavesPerRequestWithAttachment: nullableInt(),
  description: z.string().trim().max(500).nullable().optional(),
});

const updateLeavePolicySchema = createLeavePolicySchema.partial();

// holidayEndDate is optional - when set, createHoliday adds one row per day
// in the [holidayDate, holidayEndDate] range instead of just a single day.
const createHolidaySchema = z
  .object({
    holidayName: z.string().trim().min(1, "Holiday name is required.").max(150),
    holidayDate: z.coerce.date({ errorMap: () => ({ message: "Please provide a valid date." }) }),
    holidayEndDate: z.coerce.date().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isOptional: z.boolean().optional(),
  })
  .refine((data) => !data.holidayEndDate || data.holidayEndDate >= data.holidayDate, {
    message: "End date can't be before the start date.",
    path: ["holidayEndDate"],
  })
  .refine(
    (data) =>
      !data.holidayEndDate ||
      (data.holidayEndDate.getTime() - data.holidayDate.getTime()) / 86400000 <= 30,
    { message: "A holiday range can span at most 31 days.", path: ["holidayEndDate"] }
  );

// holidayEndDate isn't cross-validated against holidayDate here (unlike
// createHolidaySchema) because an omitted holidayDate means "keep the
// existing row's date," which this schema can't see - the controller does
// that comparison once it has the existing row loaded.
const updateHolidaySchema = z.object({
  holidayName: z.string().trim().min(1, "Holiday name is required.").max(150).optional(),
  holidayDate: z.coerce.date({ errorMap: () => ({ message: "Please provide a valid date." }) }).optional(),
  holidayEndDate: z.coerce.date().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isOptional: z.boolean().optional(),
});

// Empty-string form fields become null rather than an empty value, so
// clearing a field in the UI actually clears it in the database.
const nullableString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

// Same as nullableString, but an empty/absent value is left as null while a
// provided value must match the given format.
const nullablePattern = (regex, message, max, { uppercase = false } = {}) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => {
      if (!value) return null;
      return uppercase ? value.toUpperCase() : value;
    })
    .refine((value) => value === null || regex.test(value), { message });

const EMPLOYEE_CODE_REGEX = /^[A-Za-z0-9_-]+$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const UAN_REGEX = /^\d{12}$/;
const AADHAR_REGEX = /^\d{12}$/;
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PF_NUMBER_REGEX = /^[A-Za-z0-9/]+$/;

const updateUserDetailsSchema = z.object({
  employeeCode: nullablePattern(
    EMPLOYEE_CODE_REGEX,
    "Employee code can only contain letters, numbers, hyphens, and underscores.",
    50
  ),
  birthDate: z.coerce.date().max(new Date(), "Date of birth can't be in the future.").nullable().optional(),
  joiningDate: z.coerce.date().nullable().optional(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE, GENDER.OTHER]).nullable().optional(),
  pan: nullablePattern(PAN_REGEX, "PAN must be in the format ABCDE1234F.", 10, { uppercase: true }),
  panHolderName: nullableString(150),
  uan: nullablePattern(UAN_REGEX, "UAN must be exactly 12 digits.", 12),
  aadharNumber: nullablePattern(AADHAR_REGEX, "Aadhaar number must be exactly 12 digits.", 12),
  aadharHolderName: nullableString(150),
  bankAccountNumber: nullablePattern(BANK_ACCOUNT_REGEX, "Bank account number must be 9 to 18 digits.", 18),
  bankName: nullableString(150),
  ifscCode: nullablePattern(IFSC_REGEX, "IFSC code must be in the format ABCD0123456.", 11, { uppercase: true }),
  pfNumber: nullablePattern(PF_NUMBER_REGEX, "PF number can only contain letters, numbers, and slashes.", 30),
  fatherName: nullableString(150),
  spouseName: nullableString(150),
  maritalStatus: z.enum([MARITAL_STATUS.SINGLE, MARITAL_STATUS.MARRIED, MARITAL_STATUS.OTHER]).nullable().optional(),
  nationality: nullableString(100),
  qualification: nullableString(150),
  phone: nullableString(20),
  designation: nullableString(100),
  location: nullableString(100),
  taxRegime: z.enum([TAX_REGIME.OLD, TAX_REGIME.NEW]).nullable().optional(),
  residentialAddress: nullableString(500),
  wardNo: nullableString(50),
  micrCode: nullableString(20),
  residentialStatus: z
    .enum([
      RESIDENTIAL_STATUS.RESIDENT,
      RESIDENTIAL_STATUS.NON_RESIDENT,
      RESIDENTIAL_STATUS.RESIDENT_NOT_ORDINARILY_RESIDENT,
    ])
    .nullable()
    .optional(),
});

// effectiveFrom arrives as "YYYY-MM" (from the frontend's month picker) and
// is stored as the 1st of that month. Percent/amount fields mirror what used
// to be one company-wide SalaryStructureConfig, now captured per employee.
const recordSalaryStructureSchema = z.object({
  ctc: z.coerce.number().min(0, "CTC can't be negative."),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Please choose a valid month.")
    .transform((value) => {
      const [year, month] = value.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, 1));
    }),
  basicPercentOfCtc: z.coerce.number().min(0).max(100),
  hraPercentOfBasic: z.coerce.number().min(0).max(200),
  ltaPercentOfBasic: z.coerce.number().min(0).max(200),
  guaranteedAllowancePercentOfBasic: z.coerce.number().min(0).max(200),
  conveyanceMonthly: z.coerce.number().min(0),
  pfMonthlyAmount: z.coerce.number().min(0),
  professionalTax: z.coerce.number().min(0),
  professionalTaxThreshold: z.coerce.number().min(0),
});

const generatePayslipSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  tds: z.coerce.number().min(0).optional().default(0),
  annualBonusPay: z.coerce.number().min(0).optional().default(0),
});

const updateCompanySettingsSchema = z.object({
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});

// Declared once per employee per financial year - only meaningful for Old
// Regime employees (see incomeTax.service.js), but harmless to store for
// anyone. financialYear is the starting calendar year, e.g. 2025 = FY 2025-26.
const taxDeclarationSchema = z.object({
  financialYear: z.coerce.number().int().min(2000).max(2100),
  rentPaidAnnual: z.coerce.number().min(0).optional().default(0),
  isMetroCity: z.boolean().optional().default(false),
  section80C: z.coerce.number().min(0).optional().default(0),
  section80D: z.coerce.number().min(0).optional().default(0),
  homeLoanInterest: z.coerce.number().min(0).optional().default(0),
  otherIncomeSavingsInterest: z.coerce.number().min(0).optional().default(0),
  otherIncomeFDInterest: z.coerce.number().min(0).optional().default(0),
});

const generateIncomeTaxComputationSchema = z.object({
  financialYear: z.coerce.number().int().min(2000).max(2100),
});

const recordExitSchema = z.object({
  exitDate: z.coerce.date({ errorMap: () => ({ message: "Please choose a valid exit date." }) }),
  relievingLetterText: z.string().trim().min(1, "Please provide the relieving letter text.").max(5000),
});

const createOfferLetterSchema = z.object({
  offerDate: z.coerce.date({ errorMap: () => ({ message: "Please choose a valid offer date." }) }),
  letterText: z.string().trim().min(1, "Please provide the offer letter text.").max(50000),
});

const previewOfferLetterSchema = z.object({
  letterText: z.string().trim().min(1, "Please provide the offer letter text.").max(50000),
});

// Multipart form fields always arrive as strings, so value/label are plain
// strings here even though the request may also carry an uploaded file.
const customFieldSchema = z.object({
  label: z.string().trim().min(1, "Please enter a label for this field.").max(100),
  value: z.string().trim().max(500).nullable().optional(),
});

const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const projectDetailsSchema = {
  projectType: z.enum(["ASSIGNED", "NOT_ASSIGNED"], { message: "Please select whether this is a client or internal project." }),
  // Free text - admin can pick a suggested timezone or type any other label.
  timezone: z.string().trim().min(1, "Please enter a timezone.").max(100),
  workStartTime: z.string().regex(TIME_OF_DAY_REGEX, "Please enter a valid start time."),
  workEndTime: z.string().regex(TIME_OF_DAY_REGEX, "Please enter a valid end time."),
};

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Please enter a project name.").max(120),
  ...projectDetailsSchema,
});

const renameProjectSchema = z.object({
  name: z.string().trim().min(1, "Please enter a project name.").max(120),
  ...projectDetailsSchema,
});

module.exports = {
  createUserSchema,
  updateManagerSchema,
  setAdminAccessSchema,
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createHolidaySchema,
  updateHolidaySchema,
  updateUserDetailsSchema,
  customFieldSchema,
  generatePayslipSchema,
  updateCompanySettingsSchema,
  recordSalaryStructureSchema,
  recordExitSchema,
  taxDeclarationSchema,
  generateIncomeTaxComputationSchema,
  createProjectSchema,
  renameProjectSchema,
  createOfferLetterSchema,
  previewOfferLetterSchema,
};
