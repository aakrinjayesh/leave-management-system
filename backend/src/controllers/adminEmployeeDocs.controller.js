const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { EMPLOYEE_DOCUMENT_DIR } = require("../config/employeeDocumentUpload");

const DOCUMENT_FIELD_BY_TYPE = {
  pan: "panDocumentUrl",
  aadhar: "aadharDocumentUrl",
  bank: "bankDocumentUrl",
  photo: "photoUrl",
};

const documentPath = (filename) => path.join(EMPLOYEE_DOCUMENT_DIR, path.basename(filename));

// Best-effort delete - a missing/already-gone file shouldn't fail the request.
const removeFileQuietly = (filename) => {
  if (!filename) return;
  fs.unlink(documentPath(filename), () => {});
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

  removeFileQuietly(user[field]);
  const updated = await prisma.user.update({ where: { id }, data: { [field]: req.file.filename } });

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

  removeFileQuietly(user[field]);
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

  res.sendFile(documentPath(user[field]), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Document file not found." });
    }
  });
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

  const customField = await prisma.employeeCustomField.create({
    data: {
      userId,
      label: req.body.label,
      value: req.body.value || null,
      documentUrl: req.file ? req.file.filename : null,
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
    removeFileQuietly(existing.documentUrl);
    data.documentUrl = req.file.filename;
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

  removeFileQuietly(existing.documentUrl);
  await prisma.employeeCustomField.delete({ where: { id: fieldId } });

  new ApiResponse(200, "Field removed.").send(res);
});

const downloadCustomFieldDocument = asyncHandler(async (req, res) => {
  const fieldId = Number(req.params.fieldId);
  const field = await prisma.employeeCustomField.findUnique({ where: { id: fieldId } });
  if (!field || !field.documentUrl) {
    throw ApiError.notFound("No document uploaded for this field.");
  }

  res.sendFile(documentPath(field.documentUrl), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Document file not found." });
    }
  });
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
