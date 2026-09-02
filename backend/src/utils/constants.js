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

// Label only - see the EmploymentType enum comment in schema.prisma.
const EMPLOYMENT_TYPE = {
  EMPLOYEE: "EMPLOYEE",
  INTERN: "INTERN",
  CONTRACT: "CONTRACT",
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

// How many self-service profile change requests an employee may submit per
// section (Personal/Statutory/Bank) before only admin can change it - the
// counter bumps on submission, accepted or not. See profile.controller.js.
const SELF_PROFILE_EDIT_LIMIT = 3;

// The three approval-gated profile sections. `fields` are the User columns an
// employee may propose changing in that section (must line up with the
// matching updateMy*InfoSchema); `countField` is the User column that caps
// submissions at SELF_PROFILE_EDIT_LIMIT.
const PROFILE_CHANGE_SECTIONS = {
  PERSONAL: {
    label: "Personal Information",
    countField: "personalInfoEditCount",
    fields: [
      "personalEmail",
      "phone",
      "birthDate",
      "gender",
      "maritalStatus",
      "fatherName",
      "fatherMotherPhone",
      "spouseName",
      "nationality",
      "qualification",
      "photoUrl",
    ],
  },
  STATUTORY: {
    label: "Statutory Information",
    countField: "statutoryInfoEditCount",
    fields: ["pan", "panHolderName", "uan", "aadharNumber", "aadharHolderName", "panDocumentUrl", "aadharDocumentUrl"],
  },
  BANK: {
    label: "Bank Information",
    countField: "bankInfoEditCount",
    fields: ["bankAccountNumber", "bankName", "ifscCode", "bankDocumentUrl"],
  },
};

// User columns in the above that are dates, so a stored JSON string gets
// coerced back to a Date when an admin accepts the request.
const PROFILE_CHANGE_DATE_FIELDS = new Set(["birthDate"]);

// User columns in the above that hold an uploaded-file URL. These come from an
// actual file the employee attached to the section form (never a raw value in
// the request body), and need S3 cleanup when a request is accepted (old file)
// or rejected (the pending file). `uploadField` is the multipart field name the
// frontend sends the file under.
const PROFILE_CHANGE_DOCUMENTS = {
  photoUrl: { uploadField: "photo", pdfOnly: false, folder: "employee-documents/pending/profile" },
  panDocumentUrl: { uploadField: "panDocument", pdfOnly: false, folder: "employee-documents/pending/pan" },
  aadharDocumentUrl: { uploadField: "aadharDocument", pdfOnly: true, folder: "employee-documents/pending/aadhar" },
  bankDocumentUrl: { uploadField: "bankDocument", pdfOnly: false, folder: "employee-documents/pending/bank" },
};
const PROFILE_CHANGE_DOCUMENT_FIELDS = new Set(Object.keys(PROFILE_CHANGE_DOCUMENTS));

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
  EMPLOYMENT_TYPE,
  USER_STATUS,
  GENDER,
  MARITAL_STATUS,
  TAX_REGIME,
  RESIDENTIAL_STATUS,
  RESIGNATION_STATUS,
  SELF_PROFILE_EDIT_LIMIT,
  PROFILE_CHANGE_SECTIONS,
  PROFILE_CHANGE_DATE_FIELDS,
  PROFILE_CHANGE_DOCUMENTS,
  PROFILE_CHANGE_DOCUMENT_FIELDS,
  INTRO_PROMPT_KEYS,
  INTRO_ANSWER_MAX_LENGTH,
};
