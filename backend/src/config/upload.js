const path = require("path");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

// New uploads go to S3 (see uploadAttachment in employeeLeave.controller.js),
// but attachments uploaded before the S3 migration are still sitting here -
// download endpoints fall back to this directory for those legacy filenames.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "leave-attachments");

// In-memory storage - the file's buffer is handed straight to S3, nothing
// touches local disk for new uploads.
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PDF, JPEG, or PNG files are allowed."));
  }
  cb(null, true);
};

const leaveAttachmentUpload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

// Wraps multer's single-file middleware so upload errors (wrong type, too
// large) come out as a normal ApiError instead of an unhandled/500 error.
const uploadSingleLeaveAttachment = (req, res, next) => {
  leaveAttachmentUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File is too large. Max size is 2MB."));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload this file."));
  });
};

module.exports = { UPLOAD_DIR, uploadSingleLeaveAttachment };
