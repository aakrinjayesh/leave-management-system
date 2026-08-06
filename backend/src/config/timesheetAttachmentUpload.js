const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Local disk storage, same pattern as leave attachments / employee documents
// - separate folder so timesheet Excel sheets never mix with those uploads.
const TIMESHEET_ATTACHMENT_DIR = path.join(__dirname, "..", "..", "uploads", "timesheet-attachments");
fs.mkdirSync(TIMESHEET_ATTACHMENT_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TIMESHEET_ATTACHMENT_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only Excel files (.xls, .xlsx) are allowed."));
  }
  cb(null, true);
};

const timesheetAttachmentUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

// Wraps multer's single-file middleware so upload errors (wrong type, too
// large) come out as a normal ApiError instead of an unhandled/500 error.
const uploadSingleTimesheetAttachment = (req, res, next) => {
  timesheetAttachmentUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File is too large. Max size is 5MB."));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload this file."));
  });
};

module.exports = { TIMESHEET_ATTACHMENT_DIR, uploadSingleTimesheetAttachment };
