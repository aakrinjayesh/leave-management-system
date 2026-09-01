const { z } = require("zod");
const {
  GENDER,
  MARITAL_STATUS,
  INTRO_PROMPT_KEYS,
  INTRO_ANSWER_MAX_LENGTH,
} = require("../utils/constants");

// Empty-string form fields are left alone (undefined) rather than clearing
// the field - unlike admin's editor, an employee leaving a field blank on
// their own self-service form just means "not touching this one right now."
const nullableString = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

const nullablePattern = (regex, message, max, { uppercase = false } = {}) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return uppercase ? value.toUpperCase() : value;
    })
    .refine((value) => value === undefined || regex.test(value), { message });

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const UAN_REGEX = /^\d{12}$/;
const AADHAR_REGEX = /^\d{12}$/;
const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Employee's own self-service edit of their Personal Information section -
// name, employee code, and email are excluded on purpose (see
// updateMyPersonalInfo in profile.controller.js).
const updateMyPersonalInfoSchema = z.object({
  personalEmail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || z.string().email().safeParse(value).success, {
      message: "Please enter a valid personal email address.",
    }),
  phone: nullableString(20),
  birthDate: z.coerce.date().max(new Date(), "Date of birth can't be in the future.").optional(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE, GENDER.OTHER]).optional(),
  maritalStatus: z.enum([MARITAL_STATUS.SINGLE, MARITAL_STATUS.MARRIED, MARITAL_STATUS.OTHER]).optional(),
  fatherName: nullableString(150),
  fatherMotherPhone: nullableString(20),
  spouseName: nullableString(150),
  nationality: nullableString(100),
  qualification: nullableString(150),
});

// pfNumber is excluded on purpose - only admin can change it (see
// updateMyStatutoryInfo in profile.controller.js). pan/uan/aadharNumber are
// shown masked on this employee's own profile, so the frontend only sends
// them here when the employee actually typed a fresh value.
const updateMyStatutoryInfoSchema = z.object({
  pan: nullablePattern(PAN_REGEX, "PAN must be in the format ABCDE1234F.", 10, { uppercase: true }),
  panHolderName: nullableString(150),
  uan: nullablePattern(UAN_REGEX, "UAN must be exactly 12 digits.", 12),
  aadharNumber: nullablePattern(AADHAR_REGEX, "Aadhaar number must be exactly 12 digits.", 12),
  aadharHolderName: nullableString(150),
});

// salaryCtc is excluded on purpose - only admin can change it (see
// updateMyBankInfo in profile.controller.js).
const updateMyBankInfoSchema = z.object({
  bankAccountNumber: nullablePattern(BANK_ACCOUNT_REGEX, "Bank account number must be 9 to 18 digits.", 18),
  bankName: nullableString(150),
  ifscCode: nullablePattern(IFSC_REGEX, "IFSC code must be in the format ABCD0123456.", 11, { uppercase: true }),
});

// proposedLastWorkingDate is just the employee's own notice date, not yet
// official - the real, confirmed lastWorkingDate only gets set once admin
// accepts (proposedLastWorkingDate + noticePeriodDays). No minimum notice
// enforced on the proposed date itself, only that it isn't in the past.
const submitResignationSchema = z
  .object({
    reason: z.string().trim().min(5, "Please provide a short reason (at least 5 characters).").max(2000),
    proposedLastWorkingDate: z.coerce.date({ message: "Please choose your last working day." }),
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return data.proposedLastWorkingDate >= today;
    },
    {
      message: "Your last working day can't be in the past.",
      path: ["proposedLastWorkingDate"],
    }
  );

// Private "Introduce yourself" answers. Every prompt key is accepted and
// optional; a blank/whitespace answer clears that one. Unknown keys are
// rejected so the stored object can't accumulate junk.
const updateMyIntroSchema = z
  .object(
    Object.fromEntries(
      INTRO_PROMPT_KEYS.map((key) => [
        key,
        z.string().trim().max(INTRO_ANSWER_MAX_LENGTH).optional(),
      ])
    )
  )
  .strict();

module.exports = {
  submitResignationSchema,
  updateMyPersonalInfoSchema,
  updateMyStatutoryInfoSchema,
  updateMyBankInfoSchema,
  updateMyIntroSchema,
};
