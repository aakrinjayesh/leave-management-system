const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Local disk storage for now - swap the `storage` engine for a cloud
// provider (S3, Cloudinary, etc.) later without touching callers, since they
// only ever deal with the filename returned from the upload endpoint.
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads", "leave-attachments");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

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
