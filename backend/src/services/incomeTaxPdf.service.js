const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { getSlabBreakdownForGeneration } = require("./incomeTax.service");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

const RESIDENTIAL_STATUS_LABELS = {
  RESIDENT: "Resident",
  NON_RESIDENT: "Non-Resident",
  RESIDENT_NOT_ORDINARILY_RESIDENT: "Resident but Not Ordinarily Resident",
};

// Centered semi-transparent logo behind the content on every page - same
// treatment as the offer letter / payslip / relieving letter PDFs.
const drawWatermark = (doc) => {
  if (!fs.existsSync(LOGO_PATH)) return;
  const width = doc.page.width * 0.55;
  const x = (doc.page.width - width) / 2;
  const y = (doc.page.height - width) / 2;
  doc.opacity(0.12);
  doc.image(LOGO_PATH, x, y, { width });
  doc.opacity(1);
};

const money = (value) => (value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dash = (value) => (value ? value : "-");
const fyLabel = (year) => `${year}-${String(year + 1).slice(-2)}`;
const formatDateTime = (value) =>
  new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

// Draws one "LABEL : value" line at the current cursor and advances doc.y.
const drawInfoRow = (doc, x, width, label, value) => {
  doc.font("Helvetica-Bold").fontSize(8.5).text(label.toUpperCase(), x, doc.y, { width, continued: false });
  doc.font("Helvetica").fontSize(9).text(`: ${dash(value)}`, x, doc.y, { width });
  doc.moveDown(0.3);
};

// Draws one "LABEL : value" line inline (label and value on the same visual
// row), used for the two-column identity header.
const drawTwoColRow = (doc, leftX, rightX, colWidth, rowY, leftLabel, leftValue, rightLabel, rightValue) => {
  doc.font("Helvetica-Bold").fontSize(8).text(leftLabel.toUpperCase(), leftX, rowY, { width: colWidth });
  doc.font("Helvetica").fontSize(8.5).text(`: ${dash(leftValue)}`, leftX + 95, rowY, { width: colWidth - 95 });
  if (rightLabel) {
    doc.font("Helvetica-Bold").fontSize(8).text(rightLabel.toUpperCase(), rightX, rowY, { width: colWidth });
    doc.font("Helvetica").fontSize(8.5).text(`: ${dash(rightValue)}`, rightX + 95, rowY, { width: colWidth - 95 });
  }
};

// Renders the Income Tax Computation Statement PDF for one saved generation
// and pipes it to the given writable stream - same letterhead pattern as
// payslip/relieving-letter PDFs.
const streamIncomeTaxComputationPdf = ({ generation, employee }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
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

  doc.font("Helvetica-Bold").fontSize(15).text(COMPANY_NAME, textX, headerTop + 6, { width: textWidth, align: "center" });
  doc.font("Helvetica").fontSize(8).text(COMPANY_ADDRESS, textX, doc.y + 2, { width: textWidth, align: "center" });

  doc.y = Math.max(doc.y, headerTop + 50) + 8;
  doc.x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(11).text("INCOME TAX COMPUTATION STATEMENT", { align: "center" });
  doc.moveDown(0.7);

  // Identity header - two columns.
  const colWidth = pageWidth / 2 - 6;
  const leftX = doc.page.margins.left;
  const rightX = leftX + colWidth + 12;
  let rowY = doc.y;
  const rowH = 13;

  const leftRows = [
    ["Name of Assessee", `${employee.firstName} ${employee.lastName}`],
    ["PAN", employee.pan],
    ["Father's Name", employee.fatherName],
    ["Residential Address", employee.residentialAddress],
    ["Status", "Individual"],
    ["Assessment Year", fyLabel(generation.financialYear + 1)],
    ["Financial Year", fyLabel(generation.financialYear)],
  ];
  const rightRows = [
    ["Gender", employee.gender],
    ["Date of Birth", formatDate(employee.birthDate)],
    ["Email Address", employee.email],
    ["Residential Status", RESIDENTIAL_STATUS_LABELS[employee.residentialStatus] || null],
    ["Name of Bank", employee.bankName],
    ["Pin Code", employee.pinCode],
    ["IFSC Code", employee.ifscCode],
    ["Account No.", employee.bankAccountNumber],
  ];

  leftRows.forEach(([label, value], i) => {
    drawTwoColRow(doc, leftX, rightX, colWidth, rowY, label, value, rightRows[i][0], rightRows[i][1]);
    rowY += rowH;
  });
  doc.y = rowY + 4;

  doc.font("Helvetica-Bold").fontSize(8.5).text("OPTED FOR TAXATION U/S 115BAC", leftX, doc.y, { width: colWidth });
  doc.font("Helvetica").fontSize(8.5).text(`: ${generation.regime === "NEW" ? "YES" : "NO"}`, leftX + 150, doc.y - 10.5, { width: colWidth - 150 });
  doc.moveDown(0.9);

  doc.font("Helvetica-Bold").fontSize(8.5).text("COMPUTATION DATE", leftX, doc.y, { width: colWidth });
  doc.font("Helvetica").fontSize(8.5).text(`: ${formatDateTime(generation.generatedAt)}`, leftX + 150, doc.y - 10.5, { width: colWidth - 150 });
  doc.moveDown(1.2);

  // Computation of Total Income.
  doc.font("Helvetica-Bold").fontSize(10).text("COMPUTATION OF TOTAL INCOME", { align: "center" });
  doc.moveDown(0.5);

  doc.font("Helvetica-Bold").fontSize(9).text("SALARIES");
  doc.font("Helvetica").fontSize(8.5).text(COMPANY_NAME);
  doc.moveDown(0.3);

  const lineItem = (label, value, opts = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    doc.text(label, leftX, doc.y, { width: pageWidth - 110, continued: true });
    doc.text(money(value), { width: 110, align: "right" });
    doc.moveDown(0.25);
  };

  lineItem("Gross Salary", generation.grossSalary);
  lineItem("Less: Standard Deduction u/s 16(ia)", generation.standardDeduction);
  if (generation.regime === "OLD") {
    if (generation.hraExemption) lineItem("Less: HRA Exemption u/s 10(13A)", generation.hraExemption);
    if (generation.section80C) lineItem("Less: Deduction u/s 80C", generation.section80C);
    if (generation.section80D) lineItem("Less: Deduction u/s 80D", generation.section80D);
    if (generation.homeLoanInterest) lineItem("Less: Home Loan Interest u/s 24(b)", generation.homeLoanInterest);
  }
  lineItem("Taxable Salary", generation.taxableSalary, { bold: true });
  doc.moveDown(0.4);

  if (generation.otherIncomeSavingsInterest || generation.otherIncomeFDInterest) {
    doc.font("Helvetica-Bold").fontSize(9).text("Income From Other Sources (Declared by Employee)");
    doc.moveDown(0.2);
    if (generation.otherIncomeSavingsInterest) lineItem("Interest from Saving Bank A/C", generation.otherIncomeSavingsInterest);
    if (generation.otherIncomeFDInterest) lineItem("Interest from Time-Deposit", generation.otherIncomeFDInterest);
    doc.moveDown(0.3);
  }

  lineItem("Gross Total Income", generation.totalIncome, { bold: true });
  lineItem("Total Income", generation.totalIncome, { bold: true });
  lineItem("Total Income Rounded Off u/s 288A", generation.totalIncomeRounded, { bold: true });
  doc.moveDown(0.6);

  // Computation of Tax on Total Income.
  doc.font("Helvetica-Bold").fontSize(10).text("COMPUTATION OF TAX ON TOTAL INCOME", { align: "center" });
  doc.moveDown(0.4);

  const slabBreakdown = getSlabBreakdownForGeneration(generation, employee);
  slabBreakdown.forEach((slab) => {
    const label =
      slab.rate === 0
        ? `Tax on Rs. ${money(slab.amountInSlab)}`
        : `Tax on Rs. ${money(slab.amountInSlab)} (${money(slab.to)} - ${money(slab.from)}) @ ${(slab.rate * 100).toFixed(0)}%`;
    lineItem(label, slab.rate === 0 ? 0 : slab.tax);
  });
  doc.moveDown(0.3);

  if (generation.rebate87A) {
    lineItem("Less: Rebate u/s 87A", generation.rebate87A);
  }
  lineItem("Add: Health and Education Cess @ 4%", generation.cess);
  doc.moveDown(0.4);

  doc.font("Helvetica-Bold").fontSize(9).text("Less: Tax Deducted at Source");
  doc.moveDown(0.2);
  lineItem("Section 192: Salary", generation.tdsDeductedSoFar);
  doc.moveDown(0.5);

  if (generation.taxPayable > 0) {
    lineItem("Tax Payable", generation.taxPayable, { bold: true });
    lineItem("Tax Payable Rounded Off u/s 288B", generation.taxPayable, { bold: true });
  } else if (generation.taxRefundable > 0) {
    lineItem("Tax Refundable", generation.taxRefundable, { bold: true });
    lineItem("Tax Refundable Rounded Off u/s 288B", generation.taxRefundable, { bold: true });
  } else {
    lineItem("Tax Payable / Refundable", 0, { bold: true });
  }

  doc.moveDown(0.8);
  doc
    .font("Helvetica-Oblique")
    .fontSize(7.5)
    .text(
      generation.mode === "PROJECTED"
        ? `*** This is a PROJECTED estimate based on ${generation.monthsElapsed} of 12 months' payslips generated at the time this statement was created. It is not final. ***`
        : "*** This is the FINAL computation for this financial year - all 12 months' payslips existed at the time this statement was created. ***",
      { align: "center", width: pageWidth }
    );
  doc.moveDown(0.3);
  doc.font("Helvetica-Oblique").fontSize(8).text("*** This is system generated document. No signature is required. ***", {
    align: "center",
    width: pageWidth,
  });

  doc.end();
};

module.exports = { streamIncomeTaxComputationPdf };
