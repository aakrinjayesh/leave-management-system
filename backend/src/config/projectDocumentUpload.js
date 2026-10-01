const multer = require("multer");
const ApiError = require("../utils/ApiError");

// Client/company documents attached to a project (GST certificate, PAN card,
// MSME certificate, SOW, agreement). Uploaded to a generic endpoint keyed by
// document type - not tied to a project id, so it works the same whether
// admin is filling these in on a brand-new project (not saved yet) or
// editing an existing one. Buffers go straight to S3, nothing hits local disk.
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB - agreements/SOWs can run several pages

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Allowed file types: PDF, image, or Word document."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

// Wraps multer's single-file middleware so upload errors surface as a normal
// ApiError (400) instead of an unhandled 500.
const uploadSingleProjectDocument = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File is too large. Max size is 10MB."));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload this file."));
  });
};

module.exports = { uploadSingleProjectDocument };
