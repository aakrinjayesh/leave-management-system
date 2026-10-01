const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Supporting files for a reimbursement claim - receipts, invoices, tickets.
// A claim can carry several; at least one is mandatory (enforced in the
// controller, not here). Buffers go straight to S3, nothing hits local disk.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB each
const MAX_FILES = 10;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Allowed file types: PDF, image, Word, Excel, CSV or text."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES } });

// Wraps multer's array middleware so upload errors surface as a normal
// ApiError (400) instead of an unhandled 500.
const uploadReimbursementAttachments = (req, res, next) => {
  upload.array("files", MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("One of the files is too large. Max size is 5MB each."));
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return next(ApiError.badRequest(`You can attach at most ${MAX_FILES} files.`));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload these files."));
  });
};

module.exports = { uploadReimbursementAttachments, MAX_FILES };
