const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const invoiceService = require("../services/invoice.service");
const companySettingsService = require("../services/companySettings.service");
const { uploadToS3, deleteFromS3 } = require("../utils/s3.util");

const createInvoice = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice(req.body, req.user.id);

  new ApiResponse(201, "Invoice generated.", { invoice }).send(res);
});

const listInvoices = asyncHandler(async (req, res) => {
  const invoices = await invoiceService.listInvoices();

  new ApiResponse(200, "OK", { invoices }).send(res);
});

// Renders whatever is currently in the form as a PDF, without saving
// anything - lets admin see exactly how it'll look (watermark included)
// before committing to Save. Same pattern as previewOfferLetterPdf.
const previewInvoicePdf = asyncHandler(async (req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'inline; filename="invoice-preview.pdf"');
  await invoiceService.previewInvoicePdf(req.body, res);
});

// Redirects to the saved document - a .pdf or .docx depending on the format
// admin chose at Save time (Invoice.format).
const downloadInvoiceDocument = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await invoiceService.getInvoiceOr404(id);

  if (!invoice.documentUrl) {
    throw ApiError.notFound("This invoice's document isn't available.");
  }

  res.redirect(invoice.documentUrl);
});

const deleteInvoice = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await invoiceService.deleteInvoice(id);

  new ApiResponse(200, "Invoice deleted.").send(res);
});

// The authorized-signatory signature - a single company-wide image reused on
// every invoice, not per-invoice data. Replacing it cleans up the old S3
// object (best-effort - never blocks the upload).
const uploadSignature = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest("Please choose a file to upload.");
  }

  const { signatureUrl: existingUrl } = await companySettingsService.getSettings();
  const { url } = await uploadToS3(req.file, "company/signature");
  const settings = await companySettingsService.updateSignature(url);

  if (existingUrl && existingUrl !== url) {
    deleteFromS3(existingUrl).catch((err) => console.error("Failed to delete superseded signature:", err));
  }

  new ApiResponse(200, "Signature uploaded.", { signatureUrl: settings.signatureUrl }).send(res);
});

const removeSignature = asyncHandler(async (req, res) => {
  const { signatureUrl: existingUrl } = await companySettingsService.getSettings();
  await companySettingsService.updateSignature(null);

  if (existingUrl) {
    deleteFromS3(existingUrl).catch((err) => console.error("Failed to delete removed signature:", err));
  }

  new ApiResponse(200, "Signature removed.").send(res);
});

module.exports = {
  createInvoice,
  listInvoices,
  previewInvoicePdf,
  downloadInvoiceDocument,
  deleteInvoice,
  uploadSignature,
  removeSignature,
};
