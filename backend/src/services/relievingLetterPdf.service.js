const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

// Renders a relieving letter PDF - company letterhead followed by the
// admin-edited letter text - and pipes it to the given writable stream
// (typically an Express response), same pattern as payslip PDFs.
const streamRelievingLetterPdf = ({ employee, exitRecord }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 56 });
  doc.pipe(res);

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

  doc.font("Helvetica-Bold").fontSize(13).text("RELIEVING LETTER", { align: "center" });
  doc.moveDown(1.2);

  doc.font("Helvetica").fontSize(10).text(`Date: ${formatDate(exitRecord.createdAt)}`);
  doc.moveDown(0.4);
  doc.text(`To,`);
  doc.font("Helvetica-Bold").text(`${employee.firstName} ${employee.lastName}`);
  if (employee.designation) {
    doc.font("Helvetica").text(employee.designation);
  }
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(10.5).text("Subject: Relieving Letter", { underline: true });
  doc.moveDown(1);

  doc.font("Helvetica").fontSize(10.5).text(exitRecord.relievingLetterText, {
    align: "justify",
    lineGap: 4,
  });

  doc.moveDown(3);
  doc.text("For AAKRIN CONSULTING SERVICES PRIVATE LIMITED");
  doc.moveDown(2.5);
  doc.text("Authorized Signatory");

  doc.end();
};

module.exports = { streamRelievingLetterPdf };
