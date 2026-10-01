const multer = require("multer");
const ApiError = require("../utils/ApiError");

// The authorized-signatory signature image shown on generated Invoice PDFs -
// image only (it's drawn straight into the PDF via PDFKit's doc.image, which
// needs a raster image, not a PDF/doc).
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB - a signature scan/photo never needs to be larger

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Allowed file types: JPG or PNG."));
  }
  cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE_BYTES } });

const uploadSingleCompanySignature = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest("File is too large. Max size is 2MB."));
    }
    return next(ApiError.badRequest(err.message || "Couldn't upload this file."));
  });
};

module.exports = { uploadSingleCompanySignature };
