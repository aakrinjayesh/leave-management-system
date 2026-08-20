const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { uploadToS3, deleteFromS3, isS3Url } = require("../utils/s3.util");
const { EMPLOYEE_DOCUMENT_DIR } = require("../config/employeeDocumentUpload");

// Legacy document uploaded before the S3 migration - still on local disk.
const sendLegacyDocument = (res, filename) => {
  const filePath = path.join(EMPLOYEE_DOCUMENT_DIR, path.basename(filename));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Document file not found." });
    }
  });
};

const DOCUMENT_FIELD_BY_TYPE = {
  pan: "panDocumentUrl",
  aadhar: "aadharDocumentUrl",
  bank: "bankDocumentUrl",
  photo: "photoUrl",
  document: "documentUrl",
};

// Separate S3 subfolder per document type, rather than dumping every PAN,
// Aadhaar, bank doc, and photo into one shared "employee-documents" folder -
// keeps the bucket browsable instead of one long mixed list.
const DOCUMENT_FOLDER_BY_TYPE = {
  pan: "employee-documents/pan",
  aadhar: "employee-documents/aadhar",
  bank: "employee-documents/bank",
  photo: "employee-documents/profile",
  document: "employee-documents/documents",
};

// ---------- Fixed document slots (PAN / Aadhaar / Bank / Photo) ----------

const uploadUserDocument = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const field = DOCUMENT_FIELD_BY_TYPE[req.params.type];
  if (!field) {
    throw ApiError.badRequest("Unknown document type.");
  }
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  const { url } = await uploadToS3(req.file, DOCUMENT_FOLDER_BY_TYPE[req.params.type]);
  await deleteFromS3(user[field]);
  const updated = await prisma.user.update({ where: { id }, data: { [field]: url } });

  new ApiResponse(200, "Document uploaded.", { [field]: updated[field] }).send(res);
});

const deleteUserDocument = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const field = DOCUMENT_FIELD_BY_TYPE[req.params.type];
  if (!field) {
    throw ApiError.badRequest("Unknown document type.");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  await deleteFromS3(user[field]);
  await prisma.user.update({ where: { id }, data: { [field]: null } });

  new ApiResponse(200, "Document removed.").send(res);
});

const downloadUserDocument = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const field = DOCUMENT_FIELD_BY_TYPE[req.params.type];
  if (!field) {
    throw ApiError.badRequest("Unknown document type.");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user[field]) {
    throw ApiError.notFound("No document uploaded for this type.");
  }

  if (isS3Url(user[field])) {
    return res.redirect(user[field]);
  }

  sendLegacyDocument(res, user[field]);
});

// ---------- Custom fields (repeatable, admin-defined) ----------

const listCustomFields = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const customFields = await prisma.employeeCustomField.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  new ApiResponse(200, "OK", { customFields }).send(res);
});

const createCustomField = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  const documentUrl = req.file ? (await uploadToS3(req.file, "employee-documents/custom-fields")).url : null;

  const customField = await prisma.employeeCustomField.create({
    data: {
      userId,
      label: req.body.label,
      value: req.body.value || null,
      documentUrl,
    },
  });

  new ApiResponse(201, "Field added.", { customField }).send(res);
});

const updateCustomField = asyncHandler(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const existing = await prisma.employeeCustomField.findUnique({ where: { id: fieldId } });
  if (!existing) {
    throw ApiError.notFound("Field not found.");
  }

  const data = { label: req.body.label, value: req.body.value || null };
  if (req.file) {
    const { url } = await uploadToS3(req.file, "employee-documents/custom-fields");
    await deleteFromS3(existing.documentUrl);
    data.documentUrl = url;
  }

  const customField = await prisma.employeeCustomField.update({ where: { id: fieldId }, data });
  new ApiResponse(200, "Field updated.", { customField }).send(res);
});

const deleteCustomField = asyncHandler(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const existing = await prisma.employeeCustomField.findUnique({ where: { id: fieldId } });
  if (!existing) {
    throw ApiError.notFound("Field not found.");
  }

  await deleteFromS3(existing.documentUrl);
  await prisma.employeeCustomField.delete({ where: { id: fieldId } });

  new ApiResponse(200, "Field removed.").send(res);
});

const downloadCustomFieldDocument = asyncHandler(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const field = await prisma.employeeCustomField.findUnique({ where: { id: fieldId } });
  if (!field || !field.documentUrl) {
    throw ApiError.notFound("No document uploaded for this field.");
  }

  if (isS3Url(field.documentUrl)) {
    return res.redirect(field.documentUrl);
  }

  sendLegacyDocument(res, field.documentUrl);
});

module.exports = {
  uploadUserDocument,
  deleteUserDocument,
  downloadUserDocument,
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  downloadCustomFieldDocument,
};
