const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const money = (value) =>
  `INR ${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const drawWatermark = (doc) => {
  if (!fs.existsSync(LOGO_PATH)) return;
  const width = doc.page.width * 0.55;
  const x = (doc.page.width - width) / 2;
  const y = (doc.page.height - width) / 2;
  doc.opacity(0.12);
  doc.image(LOGO_PATH, x, y, { width });
  doc.opacity(1);
};

// Contract-hire payment slip: letterhead, then a 3-row table
// (Gross Payment / TDS @rate% / Net Payment). Same render/stream shape as the
// payslip + relieving-letter PDFs. Never used for regular employees/interns.
const streamContractPaymentPdf = ({ payment, employee }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  doc.pipe(res);

  doc.on("pageAdded", () => drawWatermark(doc));
  drawWatermark(doc);

  const headerTop = doc.y;
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, doc.page.margins.left, headerTop, { width: 55 });
  }

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textX = hasLogo ? doc.page.margins.left + 65 : doc.page.margins.left;
  const textWidth = hasLogo ? pageWidth - 65 : pageWidth;

  doc.font("Helvetica-Bold").fontSize(16).text(COMPANY_NAME, textX, headerTop + 6, { width: textWidth, align: "center" });
  doc.font("Helvetica").fontSize(8.5).text(COMPANY_ADDRESS, textX, doc.y + 2, { width: textWidth, align: "center" });

  doc.y = Math.max(doc.y, headerTop + 55) + 20;
  doc.x = doc.page.margins.left;

  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(1.2);

  doc.font("Helvetica-Bold").fontSize(13).text("CONTRACT PAYSLIP", { align: "center" });
  doc.moveDown(0.4);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`For the month of ${MONTH_NAMES[payment.month - 1]} ${payment.year}`, { align: "center" });
  doc.moveDown(1.2);

  doc.font("Helvetica").fontSize(10).text("Name: ", { continued: true });
  doc.font("Helvetica-Bold").text(`${employee.firstName} ${employee.lastName}`);
  if (employee.employeeCode) {
    doc.font("Helvetica").text("Employee Code: ", { continued: true });
    doc.font("Helvetica-Bold").text(employee.employeeCode);
  }
  doc.font("Helvetica").text("Engagement: ", { continued: true });
  doc.font("Helvetica-Bold").text("Hire to Contract");
  doc.moveDown(1);

  // ── Table ──────────────────────────────────────────────────────────────
  const tableLeft = doc.page.margins.left;
  const tableRight = doc.page.width - doc.page.margins.right;
  const rowHeight = 26;
  const amountColWidth = 150;
  const labelWidth = tableRight - tableLeft - amountColWidth;

  const drawRow = (label, amount, { bold = false } = {}) => {
    const y = doc.y;
    doc.rect(tableLeft, y, tableRight - tableLeft, rowHeight).stroke();
    doc.moveTo(tableLeft + labelWidth, y).lineTo(tableLeft + labelWidth, y + rowHeight).stroke();
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10.5)
      .text(label, tableLeft + 10, y + 8, { width: labelWidth - 20 });
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10.5)
      .text(amount, tableLeft + labelWidth + 10, y + 8, { width: amountColWidth - 20, align: "right" });
    doc.y = y + rowHeight;
    doc.x = tableLeft;
  };

  drawRow("Gross Payment", money(payment.grossPayment), { bold: true });
  drawRow(`TDS @ ${payment.tdsRatePercent}%`, money(payment.tdsAmount));
  drawRow("Net Payment", money(payment.netPayment), { bold: true });

  doc.moveDown(2);
  doc.font("Helvetica").fontSize(9).text(
    "Net Payment = Gross Payment less TDS. This statement is computer-generated and does not require a signature.",
    { width: pageWidth }
  );

  doc.moveDown(3);
  doc.text("For AAKRIN CONSULTING SERVICES PRIVATE LIMITED");
  doc.moveDown(2.5);
  doc.text("Authorized Signatory");

  doc.end();
};

module.exports = { streamContractPaymentPdf };
