const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const COMPANY_CIN = "U72900KA2023PTC170648";
const COMPANY_GSTIN = "29AAYCA2765K1ZT";
const COMPANY_PAN = "AAYCA2765K";
// Karnataka - the company's own registered state. Place-of-supply logic on
// the invoice form compares the client's state against this to decide
// CGST+SGST vs IGST (see invoice.service.js).
const COMPANY_STATE = "Karnataka";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

const DEFAULT_DECLARATION =
  "We declare that Invoice shows the actual price of the goods/ Services, described and that all particulars are true and correct. If you have any questions or concerns regarding this invoice, please contact krishna@aakrin.com or Accounts@aakrin.com";
const DEFAULT_PAYMENT_ADVICE = "Payment is due within 15 days from the date of this invoice.";

const drawWatermark = (doc) => {
  if (!fs.existsSync(LOGO_PATH)) return;
  const width = doc.page.width * 0.55;
  const x = (doc.page.width - width) / 2;
  const y = (doc.page.height - width) / 2;
  doc.opacity(0.12);
  doc.image(LOGO_PATH, x, y, { width });
  doc.opacity(1);
};

const money = (value) =>
  (value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

// Draws a bordered row of cells at the current doc.y, advancing it by the
// row height - the same bordered-table technique used by the payslip and
// contract-payment PDFs, generalised to N columns. Vertically centers each
// cell's text by default (fine for the usual single-line rows), but a
// multi-line cell (e.g. a wrapped description) needs `valign: "top"` -
// centering only accounts for one line's height, so a taller block of text
// would otherwise start too low and spill into the row below it.
const drawTableRow = (doc, { x, y, colWidths, cells, height = 20, bold = false, fontSize = 9.5, align = [], valign = [] }) => {
  let cursorX = x;
  doc.rect(x, y, colWidths.reduce((a, b) => a + b, 0), height).stroke();
  for (let i = 0; i < colWidths.length - 1; i++) {
    cursorX += colWidths[i];
    doc.moveTo(cursorX, y).lineTo(cursorX, y + height).stroke();
  }
  cursorX = x;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  cells.forEach((cell, i) => {
    const cellWidth = colWidths[i] - 12;
    const textY =
      valign[i] === "top"
        ? y + 8
        : y + height / 2 - doc.heightOfString(cell, { width: cellWidth, fontSize }) / 2;
    doc.text(cell, cursorX + 6, textY, { width: cellWidth, align: align[i] || "left" });
    cursorX += colWidths[i];
  });
  return y + height;
};

// Renders the Tax Invoice PDF matching the company's letterhead + fixed
// header/footer, and pipes it to the given writable stream (typically an
// Express response). `invoice` already carries the frozen tax
// amounts/taxType computed at creation time (see invoice.service.js) -
// nothing is recomputed here.
const streamInvoicePdf = ({ invoice, signatureBuffer }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
  doc.pipe(res);

  doc.on("pageAdded", () => drawWatermark(doc));
  drawWatermark(doc);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // ── Header (same company letterhead on every page this document has) ────
  const headerTop = doc.y;
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, left, headerTop, { width: 50 });
  }
  const textX = hasLogo ? left + 60 : left;
  const textWidth = hasLogo ? pageWidth - 60 : pageWidth;

  doc.font("Helvetica-Bold").fontSize(15).text(COMPANY_NAME, textX, headerTop + 2, { width: textWidth, align: "center" });
  doc.font("Helvetica").fontSize(8).text(COMPANY_ADDRESS, textX, doc.y + 2, { width: textWidth, align: "center" });
  doc
    .font("Helvetica")
    .fontSize(8)
    .text(`PAN: ${COMPANY_PAN}, CIN: ${COMPANY_CIN}, GST: ${COMPANY_GSTIN}`, textX, doc.y + 2, {
      width: textWidth,
      align: "center",
    });

  doc.y = Math.max(doc.y, headerTop + 50) + 10;
  doc.x = left;
  doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).stroke();
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(13).text("TAX INVOICE", { align: "center" });
  doc.moveDown(0.8);

  // ── Invoice No / Date ─────────────────────────────────────────────────
  const metaColW = pageWidth / 2;
  let y = doc.y;
  y = drawTableRow(doc, {
    x: left,
    y,
    colWidths: [metaColW, metaColW],
    cells: [`Invoice No: ${invoice.invoiceNo}`, `Invoice Date: ${formatDate(invoice.invoiceDate)}`],
    height: 22,
    bold: true,
  });
  doc.y = y + 12;

  // ── Bill To ───────────────────────────────────────────────────────────
  // Each piece (name / address / GSTIN / place of supply) gets its own line
  // with real spacing between them - packing GSTIN and POS onto one tight
  // line previously made the box read as a jumble of runes.
  doc.x = left;
  doc.font("Helvetica-Bold").fontSize(9.5).text("Bill To", left, doc.y);
  doc.moveDown(0.3);

  const billBoxTop = doc.y;
  const innerX = left + 10;
  const innerWidth = pageWidth - 20;
  let cursorY = billBoxTop + 10;

  doc.font("Helvetica-Bold").fontSize(10.5).text(invoice.clientFullName, innerX, cursorY, { width: innerWidth });
  cursorY = doc.y + 5;

  if (invoice.clientAddress) {
    doc.font("Helvetica").fontSize(9).text(invoice.clientAddress, innerX, cursorY, { width: innerWidth });
    cursorY = doc.y + 7;
  }

  if (invoice.clientGstNumber) {
    doc.font("Helvetica").fontSize(9).text(`GSTIN: ${invoice.clientGstNumber}`, innerX, cursorY, { width: innerWidth });
    cursorY = doc.y + 4;
  }

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(`Place of Supply: ${invoice.clientState || "-"}`, innerX, cursorY, { width: innerWidth });
  cursorY = doc.y + 10;

  const billBoxBottom = cursorY;
  doc.rect(left, billBoxTop, pageWidth, billBoxBottom - billBoxTop).stroke();
  doc.y = billBoxBottom;

  // ── Payment advice ────────────────────────────────────────────────────
  const paymentAdviceText = invoice.paymentAdviceText || DEFAULT_PAYMENT_ADVICE;
  y = drawTableRow(doc, {
    x: left,
    y: doc.y,
    colWidths: [pageWidth],
    cells: [`Payment Advice: ${paymentAdviceText}`],
    height: Math.max(20, doc.heightOfString(`Payment Advice: ${paymentAdviceText}`, { width: pageWidth - 12, fontSize: 9 }) + 10),
    fontSize: 9,
  });
  doc.y = y + 14;

  // ── Services table ────────────────────────────────────────────────────
  // No separate HSN column - HSN/SAC is appended as its own line inside the
  // description cell, matching the company's actual invoice template.
  const snoW = 35;
  const amtW = 130;
  const descW = pageWidth - snoW - amtW;
  const descText = invoice.hsnCode ? `${invoice.description}\n\nHSN: ${invoice.hsnCode}` : invoice.description;

  y = doc.y;
  y = drawTableRow(doc, {
    x: left,
    y,
    colWidths: [snoW, descW, amtW],
    cells: ["S No", "Description of Services", "Total Amount INR"],
    height: 20,
    bold: true,
    align: ["center", "left", "right"],
  });

  const descHeight = Math.max(24, doc.heightOfString(descText, { width: descW - 12, fontSize: 9.5 }) + 16);
  y = drawTableRow(doc, {
    x: left,
    y,
    colWidths: [snoW, descW, amtW],
    cells: ["1", descText, money(invoice.totalTaxableValue)],
    height: descHeight,
    align: ["center", "left", "right"],
    valign: ["top", "top", "top"],
  });

  const totalsColW = snoW + descW;
  y = drawTableRow(doc, {
    x: left,
    y,
    colWidths: [totalsColW, amtW],
    cells: ["Total Taxable Value", money(invoice.totalTaxableValue)],
    height: 20,
    bold: true,
    align: ["right", "right"],
  });

  if (invoice.taxType === "IGST") {
    y = drawTableRow(doc, {
      x: left,
      y,
      colWidths: [totalsColW, amtW],
      cells: [`IGST @ 18% of Total Taxable Value`, money(invoice.igstAmount)],
      height: 20,
      align: ["right", "right"],
    });
  } else {
    y = drawTableRow(doc, {
      x: left,
      y,
      colWidths: [totalsColW, amtW],
      cells: [`CGST @ 9% of Total Taxable Value`, money(invoice.cgstAmount)],
      height: 20,
      align: ["right", "right"],
    });
    y = drawTableRow(doc, {
      x: left,
      y,
      colWidths: [totalsColW, amtW],
      cells: [`SGST @ 9% of Total Taxable Value`, money(invoice.sgstAmount)],
      height: 20,
      align: ["right", "right"],
    });
  }

  y = drawTableRow(doc, {
    x: left,
    y,
    colWidths: [totalsColW, amtW],
    cells: ["Total Invoice Value", `INR ${money(invoice.totalInvoiceValue)}`],
    height: 22,
    bold: true,
    fontSize: 10.5,
    align: ["right", "right"],
  });
  doc.y = y + 8;

  doc.x = left;
  doc
    .font("Helvetica-Oblique")
    .fontSize(8.5)
    .text(`Amount in Words: ${invoice.amountInWords}`, left, doc.y, { width: pageWidth });
  doc.moveDown(1);

  // ── Bank details ("Kindly Make the Payment to :") - only shown when at
  // least one bank field was provided. Account Name defaults to the
  // company's own name but is editable per invoice (data.bankAccountName).
  const hasBankDetails = invoice.bankName || invoice.bankAccountNumber || invoice.bankIfscCode || invoice.bankAccountName;
  if (hasBankDetails) {
    doc.x = left;
    doc.font("Helvetica-Bold").fontSize(9.5).text("Kindly Make the Payment to :", left, doc.y);
    doc.moveDown(0.2);
    const bankBoxTop = doc.y;
    doc.font("Helvetica").fontSize(9);
    const bankLines = [
      `Account Name: ${invoice.bankAccountName || COMPANY_NAME}`,
      invoice.bankName ? `Bank Name: ${invoice.bankName}` : null,
      invoice.bankAccountNumber ? `Account Number: ${invoice.bankAccountNumber}` : null,
      invoice.bankIfscCode ? `IFSC Code: ${invoice.bankIfscCode}` : null,
    ].filter(Boolean);
    let cursorY = bankBoxTop + 10;
    for (const line of bankLines) {
      doc.text(line, left + 10, cursorY, { width: pageWidth - 20 });
      cursorY = doc.y + 5;
    }
    const bankBoxBottom = cursorY + 5;
    doc.rect(left, bankBoxTop, pageWidth, bankBoxBottom - bankBoxTop).stroke();
    doc.y = bankBoxBottom + 14;
  }

  // ── Declaration + Signature, side by side in one bordered row ──────────
  const declarationText = invoice.declarationText || DEFAULT_DECLARATION;
  const sigColW = 170;
  const declColW = pageWidth - sigColW;
  const declHeight = doc.heightOfString(declarationText, { width: declColW - 16, fontSize: 8.5 });
  const rowHeight = Math.max(90, declHeight + 30);

  const declBoxTop = doc.y;
  doc.rect(left, declBoxTop, pageWidth, rowHeight).stroke();
  doc.moveTo(left + declColW, declBoxTop).lineTo(left + declColW, declBoxTop + rowHeight).stroke();

  doc.font("Helvetica-Bold").fontSize(9).text("Declaration:", left + 8, declBoxTop + 8, { width: declColW - 16 });
  doc.font("Helvetica").fontSize(8.5).text(declarationText, left + 8, doc.y + 2, { width: declColW - 16 });

  doc
    .font("Helvetica")
    .fontSize(9)
    .text(`For ${COMPANY_NAME}`, left + declColW + 8, declBoxTop + 8, { width: sigColW - 16, align: "center" });

  if (signatureBuffer) {
    const sigImgWidth = Math.min(100, sigColW - 32);
    try {
      doc.image(signatureBuffer, left + declColW + (sigColW - sigImgWidth) / 2, declBoxTop + rowHeight - 46, {
        width: sigImgWidth,
        height: 26,
        fit: [sigImgWidth, 26],
      });
    } catch (err) {
      // A corrupt/unsupported image should never break invoice generation -
      // it just falls back to the text-only signature block below.
      console.error("Failed to draw signature image on invoice PDF:", err);
    }
  }

  doc
    .font("Helvetica")
    .fontSize(9)
    .text("Authorized Signatory", left + declColW + 8, declBoxTop + rowHeight - 20, {
      width: sigColW - 16,
      align: "center",
    });

  doc.y = declBoxTop + rowHeight + 16;

  // ── Footer (same header data repeated on every page) ────────────────────
  // Text placed here sits below the page's normal printable area (in the
  // bottom margin itself) - PDFKit's auto-pagination would otherwise treat
  // that as an overflow and silently insert a blank extra page, so the
  // bottom margin constraint is dropped for the duration of this loop.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const footerY = doc.page.height - bottomMargin + 10;
    doc.moveTo(left, footerY).lineTo(left + pageWidth, footerY).stroke();
    doc
      .font("Helvetica-Oblique")
      .fontSize(7)
      .text(
        `Reg Office: ${COMPANY_ADDRESS} PAN: ${COMPANY_PAN}, CIN: ${COMPANY_CIN}, GST: ${COMPANY_GSTIN}.`,
        left,
        footerY + 4,
        { width: pageWidth, align: "center", lineBreak: false, underline: true }
      );
    doc.font("Helvetica").fontSize(7).text(`Page ${i - range.start + 1} of ${range.count}`, left, footerY + 16, {
      width: pageWidth,
      align: "center",
      lineBreak: false,
    });

    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
};

module.exports = { streamInvoicePdf, COMPANY_STATE, DEFAULT_DECLARATION, DEFAULT_PAYMENT_ADVICE };
