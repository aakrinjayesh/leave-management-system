const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3, deleteFromS3 } = require("../utils/s3.util");
const { amountInWordsInr } = require("../utils/numberToWords.util");
const { streamInvoicePdf, COMPANY_STATE } = require("./invoicePdf.service");
const { buildInvoiceDocxBuffer } = require("./invoiceDocx.service");
const companySettingsService = require("./companySettings.service");

// The signature is a permanent public S3 URL (see CompanySettings.signatureUrl)
// - PDFKit needs actual image bytes, not a URL, so it's fetched fresh for
// every generated PDF. A fetch failure (network blip, deleted object) just
// falls back to no signature image rather than failing the whole invoice.
const fetchSignatureBuffer = async (signatureUrl) => {
  if (!signatureUrl) return null;
  try {
    const res = await fetch(signatureUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error("Failed to fetch signature image for invoice PDF:", err);
    return null;
  }
};

const IGST_RATE = 0.18;
const CGST_RATE = 0.09;
const SGST_RATE = 0.09;

// Same state as the company (Karnataka) = intra-state supply = CGST+SGST.
// Any other state (or no state on file) = inter-state supply = IGST. This is
// the standard GST place-of-supply rule, decided here server-side rather
// than trusted from the request.
const computeTax = (totalTaxableValue, clientState) => {
  const isIntraState = (clientState || "").trim().toLowerCase() === COMPANY_STATE.toLowerCase();

  if (isIntraState) {
    const cgstAmount = Math.round(totalTaxableValue * CGST_RATE * 100) / 100;
    const sgstAmount = Math.round(totalTaxableValue * SGST_RATE * 100) / 100;
    return {
      taxType: "CGST_SGST",
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalInvoiceValue: Math.round((totalTaxableValue + cgstAmount + sgstAmount) * 100) / 100,
    };
  }

  const igstAmount = Math.round(totalTaxableValue * IGST_RATE * 100) / 100;
  return {
    taxType: "IGST",
    igstAmount,
    cgstAmount: 0,
    sgstAmount: 0,
    totalInvoiceValue: Math.round((totalTaxableValue + igstAmount) * 100) / 100,
  };
};

const listInvoices = () =>
  prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, name: true } },
      generatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

const getInvoiceOr404 = async (id) => {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    throw ApiError.notFound("Invoice not found.");
  }
  return invoice;
};

// Everything streamInvoicePdf needs, computed from a raw form payload -
// shared by createInvoice (persisted) and previewInvoicePdf (rendered on the
// fly, never saved) so the two can never visually drift apart.
const buildInvoiceRenderData = (data) => {
  const tax = computeTax(data.totalTaxableValue, data.clientState);
  const amountInWords = amountInWordsInr(tax.totalInvoiceValue);

  return {
    invoiceNo: data.invoiceNo,
    invoiceDate: data.invoiceDate,
    clientFullName: data.clientFullName,
    clientAddress: data.clientAddress,
    clientState: data.clientState,
    clientGstNumber: data.clientGstNumber,
    hsnCode: data.hsnCode,
    description: data.description,
    paymentAdviceText: data.paymentAdviceText,
    totalTaxableValue: data.totalTaxableValue,
    ...tax,
    amountInWords,
    bankAccountName: data.bankAccountName,
    bankName: data.bankName,
    bankAccountNumber: data.bankAccountNumber,
    bankIfscCode: data.bankIfscCode,
    declarationText: data.declarationText,
  };
};

const getSignatureBuffer = async () => {
  const { signatureUrl } = await companySettingsService.getSettings();
  return fetchSignatureBuffer(signatureUrl);
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Every generated invoice is a permanent, immutable record (like a payslip) -
// the tax figures/amount-in-words are computed once here and frozen onto the
// row, never recalculated later even if the underlying project's client
// details change afterward. `format` (PDF or WORD, chosen by admin at Save)
// decides which renderer produces the saved document - the Preview button
// always uses the PDF renderer regardless, since a browser tab can't show an
// inline .docx the way it shows a PDF.
const createInvoice = async (data, generatedById) => {
  const renderData = buildInvoiceRenderData(data);
  const format = data.format === "WORD" ? "WORD" : "PDF";

  const invoice = await prisma.invoice.create({
    data: { ...renderData, format, projectId: data.projectId || null, generatedById },
  });

  const signatureBuffer = await getSignatureBuffer();

  let url;
  if (format === "WORD") {
    const buffer = await buildInvoiceDocxBuffer({ invoice, signatureBuffer });
    ({ url } = await uploadToS3(
      { buffer, originalname: `invoice-${invoice.invoiceNo}.docx`, mimetype: DOCX_MIME },
      "invoices"
    ));
  } else {
    const buffer = await renderPdfToBuffer(streamInvoicePdf, { invoice, signatureBuffer });
    ({ url } = await uploadToS3(
      { buffer, originalname: `invoice-${invoice.invoiceNo}.pdf`, mimetype: "application/pdf" },
      "invoices"
    ));
  }

  return prisma.invoice.update({ where: { id: invoice.id }, data: { documentUrl: url } });
};

// Renders exactly what Save would produce (same data, same watermark, same
// signature) but straight to the response stream - nothing is written to
// the database or S3, so admin can check the PDF as many times as they like
// before committing to Save.
const previewInvoicePdf = async (data, res) => {
  const invoice = buildInvoiceRenderData(data);
  const signatureBuffer = await getSignatureBuffer();
  streamInvoicePdf({ invoice, signatureBuffer }, res);
};

const deleteInvoice = async (id) => {
  const invoice = await getInvoiceOr404(id);
  if (invoice.documentUrl) {
    deleteFromS3(invoice.documentUrl).catch((err) => console.error("Failed to delete invoice document from S3:", err));
  }
  await prisma.invoice.delete({ where: { id } });
};

module.exports = {
  computeTax,
  listInvoices,
  getInvoiceOr404,
  createInvoice,
  previewInvoicePdf,
  deleteInvoice,
};
