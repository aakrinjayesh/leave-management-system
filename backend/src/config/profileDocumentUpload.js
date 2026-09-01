const multer = require("multer");
const ApiError = require("../utils/ApiError");
const { PROFILE_CHANGE_DOCUMENTS } = require("../utils/constants");

// Multipart handler for the employee's self-service profile section forms
// (Personal / Statutory / Bank). Each form is mostly text fields, but may also
// carry one or two document files - the middleware accepts every possible
// file field and the controller picks out the ones relevant to that section.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// multipart field name -> whether it must be a PDF, from the shared config.
const PDF_ONLY_FIELDS = new Set(
  Object.values(PROFILE_CHANGE_DOCUMENTS)
    .filter((d) => d.pdfOnly)
    .map((d) => d.uploadField)
);
const UPLOAD_FIELDS = Object.values(PROFILE_CHANGE_DOCUMENTS).map((d) => ({ name: d.uploadField, maxCount: 1 }));

const fileFilter = (req, file, cb) => {
  if (PDF_ONLY_FIELDS.has(file.fieldname)) {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("The Aadhaar card must be a PDF file."));
    }
    return cb(null, true);
  }
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PDF, Word, JPEG, or PNG files are allowed."));
  }
  cb(null, true);
};

const upload = multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

const uploadProfileSectionDocuments = (req, res, next) => {
  upload.fields(UPLOAD_FIELDS)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File is too large. Max size is 2MB."));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload this file."));
  });
};

module.exports = { uploadProfileSectionDocuments };
