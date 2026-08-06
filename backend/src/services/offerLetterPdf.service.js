const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const COMPANY_CIN = "U72900KA2023PTC170648";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

// Centered logo behind the letter content on every page - a bit more visible
// than the app's own 0.05 background watermark (base.css), since a printed
// page needs more contrast than a screen background to still read as one.
const drawWatermark = (doc) => {
  if (!fs.existsSync(LOGO_PATH)) return;

  const width = doc.page.width * 0.55;
  const x = (doc.page.width - width) / 2;
  const y = (doc.page.height - width) / 2;

  doc.opacity(0.12);
  doc.image(LOGO_PATH, x, y, { width });
  doc.opacity(1);
};

// Draws the company letterhead at the top of the current page and leaves the
// cursor positioned below it - called for the first page and again on every
// subsequent page pdfkit adds while paginating the (many-page) letter body.
const drawLetterhead = (doc) => {
  const headerTop = doc.page.margins.top;
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, doc.page.margins.left, headerTop, { width: 55 });
  }

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textX = hasLogo ? doc.page.margins.left + 65 : doc.page.margins.left;
  const textWidth = hasLogo ? pageWidth - 65 : pageWidth;

  doc.font("Helvetica-Bold").fontSize(16).text(COMPANY_NAME, textX, headerTop + 6, { width: textWidth, align: "center" });
  doc.font("Helvetica").fontSize(8.5).text(COMPANY_ADDRESS, textX, doc.y + 2, { width: textWidth, align: "center" });

  const ruleY = Math.max(doc.y, headerTop + 55) + 12;
  doc.moveTo(doc.page.margins.left, ruleY).lineTo(doc.page.width - doc.page.margins.right, ruleY).stroke();

  doc.x = doc.page.margins.left;
  doc.y = ruleY + 16;
};

// Draws the Registered Office address + CIN at the bottom of the current
// page - only "Reg Office:" itself is underlined, matching the company's
// standard letterhead footer. Sits inside the page's bottom margin, below
// where the auto-paginated letter body is ever allowed to flow - so the
// bottom margin is temporarily zeroed while drawing it, otherwise pdfkit
// treats this position as overflowing the page and silently inserts a new
// (blank) page right in the middle of the per-page footer loop below.
const drawFooter = (doc) => {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const ruleY = doc.page.height - 40;

  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.moveTo(left, ruleY).lineTo(right, ruleY).stroke();
  doc.font("Helvetica-Bold").fontSize(9).text("Reg Office: ", left, ruleY + 6, { continued: true, underline: true, width });
  doc.font("Helvetica").text(`${COMPANY_ADDRESS} CIN: ${COMPANY_CIN}.`, { underline: false });

  doc.page.margins.bottom = originalBottomMargin;
};

// Renders the offer letter PDF - company letterhead (repeated on every page,
// since the admin-edited letter body runs many pages) followed by that body
// text - and pipes it to the given writable stream, same pattern as the
// relieving letter PDF. The letter's own "Date:"/"Dear ..."/"Subject:" lines
// are part of the editable text itself, not drawn separately here.
const streamOfferLetterPdf = ({ offerLetter }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
  doc.pipe(res);

  doc.on("pageAdded", () => {
    drawWatermark(doc);
    drawLetterhead(doc);
  });
  drawWatermark(doc);
  drawLetterhead(doc);

  doc.font("Helvetica").fontSize(10).text(offerLetter.letterText, {
    align: "justify",
    lineGap: 4,
  });

  // Footer can only be drawn once every page the body flows onto actually
  // exists, so this runs after the body text above - via bufferPages, going
  // back and stamping each already-laid-out page rather than drawing it
  // page-by-page as content streams out.
  const pageRange = doc.bufferedPageRange();
  for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc);
  }

  doc.end();
};

module.exports = { streamOfferLetterPdf };
