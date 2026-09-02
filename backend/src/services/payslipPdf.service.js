const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

const MONTH_NAMES = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

// Centered semi-transparent logo behind the content on every page - same
// treatment as the offer letter / relieving letter PDFs.
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
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const dash = (value) => (value ? value : "-");
const TAX_REGIME_LABELS = { OLD: "Old Tax Regime", NEW: "New Tax Regime" };

const EARNING_ROWS = [
  ["Basic", "basic"],
  ["HRA", "hra"],
  ["LTA", "lta"],
  ["Conveyance", "conveyance"],
  ["Special Allowance", "specialAllowance"],
  ["Guaranteed Allowance", "guaranteedAllowance"],
  ["Annual Bonus Pay", "annualBonusPay"],
];

const DEDUCTION_ROWS = [
  ["Provident Fund", "pfEmployee"],
  ["Professional Tax", "professionalTax"],
  ["TDS", "tds"],
  ["Loss of Pay", "lopAmount"],
];

// Draws a two-column table (Description | Amount | YTD) inside the given
// bounds, returning the y position right after the last row.
const drawColumnTable = (doc, { x, width, y, title, rows, payslip, ytd }) => {
  const descW = width * 0.5;
  const amtW = width * 0.25;
  const ytdW = width - descW - amtW;
  const rowH = 16;
  let cursorY = y;

  doc.font("Helvetica-Bold").fontSize(9);
  doc.rect(x, cursorY, width, rowH).stroke();
  doc.text(title, x + 4, cursorY + 4, { width: descW - 8 });
  cursorY += rowH;

  doc.rect(x, cursorY, descW, rowH).stroke();
  doc.rect(x + descW, cursorY, amtW, rowH).stroke();
  doc.rect(x + descW + amtW, cursorY, ytdW, rowH).stroke();
  doc.text("Description", x + 4, cursorY + 4);
  doc.text("Amount", x + descW + 4, cursorY + 4);
  doc.text("YTD", x + descW + amtW + 4, cursorY + 4);
  cursorY += rowH;

  doc.font("Helvetica").fontSize(9);
  let subtotal = 0;
  let subtotalYtd = 0;
  for (const [label, field] of rows) {
    const amount = payslip[field] || 0;
    const ytdAmount = ytd[field] || 0;
    subtotal += amount;
    subtotalYtd += ytdAmount;

    doc.rect(x, cursorY, descW, rowH).stroke();
    doc.rect(x + descW, cursorY, amtW, rowH).stroke();
    doc.rect(x + descW + amtW, cursorY, ytdW, rowH).stroke();
    doc.text(label, x + 4, cursorY + 4, { width: descW - 8 });
    doc.text(amount ? money(amount) : "-", x + descW + 4, cursorY + 4, { width: amtW - 8, align: "right" });
    doc.text(ytdAmount ? money(ytdAmount) : "-", x + descW + amtW + 4, cursorY + 4, { width: ytdW - 8, align: "right" });
    cursorY += rowH;
  }

  return { bottomY: cursorY, subtotal, subtotalYtd };
};

// Renders a payslip PDF matching the company's payslip layout and pipes it
// to the given writable stream (typically an Express response).
const streamPayslipPdf = ({ payslip, employee, ytd }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  doc.on("pageAdded", () => drawWatermark(doc));
  drawWatermark(doc);

  const headerTop = doc.y;
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, doc.page.margins.left, headerTop, { width: 55 });
  }

  const headerPageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const textX = hasLogo ? doc.page.margins.left + 65 : doc.page.margins.left;
  const textWidth = hasLogo ? headerPageWidth - 65 : headerPageWidth;

  doc.font("Helvetica-Bold").fontSize(16).text(COMPANY_NAME, textX, headerTop + 6, { width: textWidth, align: "center" });
  doc.font("Helvetica").fontSize(8.5).text(COMPANY_ADDRESS, textX, doc.y + 2, { width: textWidth, align: "center" });

  doc.y = Math.max(doc.y, headerTop + 55) + 10;
  doc.x = doc.page.margins.left;
  doc.font("Helvetica-Bold").fontSize(11).text(`PAYSLIP FOR THE MONTH OF ${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`, {
    align: "center",
  });
  doc.moveDown(0.6);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const infoX = doc.page.margins.left;
  const infoY = doc.y;
  const infoColW = pageWidth / 2;
  const infoRowH = 14;

  const leftRows = [
    ["Emp No", dash(employee.employeeCode)],
    ["Name", `${employee.firstName} ${employee.lastName}`],
    ["Designation", dash(employee.designation)],
    ["UAN", dash(employee.uan)],
    ["PAN", dash(employee.pan)],
    ["Standard Days", dash(payslip.standardDays)],
    ["Bank", dash(employee.bankName)],
    ["A/C No", dash(employee.bankAccountNumber)],
  ];
  const rightRows = [
    ["PF No", dash(employee.pfNumber)],
    ["Date of Joining", formatDate(employee.joiningDate)],
    ["Location", dash(employee.location)],
    ["Regime Type", TAX_REGIME_LABELS[employee.taxRegime] || "-"],
    ["Gender", dash(employee.gender)],
    ["Days Worked", dash(payslip.daysWorked)],
    ["", ""],
    ["", ""],
  ];

  doc.rect(infoX, infoY, pageWidth, infoRowH * leftRows.length).stroke();
  doc.moveTo(infoX + infoColW, infoY).lineTo(infoX + infoColW, infoY + infoRowH * leftRows.length).stroke();

  doc.font("Helvetica").fontSize(9);
  leftRows.forEach(([label, value], i) => {
    const rowY = infoY + i * infoRowH + 3;
    if (label) doc.text(`${label}: ${value}`, infoX + 6, rowY, { width: infoColW - 12 });
  });
  rightRows.forEach(([label, value], i) => {
    const rowY = infoY + i * infoRowH + 3;
    if (label) doc.text(`${label}: ${value}`, infoX + infoColW + 6, rowY, { width: infoColW - 12 });
  });

  let tableY = infoY + infoRowH * leftRows.length + 12;
  const colWidth = pageWidth / 2 - 6;

  // Earnings: hide any line that's zero for both the month and YTD (e.g. LTA /
  // Special Allowance / Guaranteed Allowance when the structure doesn't use
  // them). Deductions still list every line.
  const visibleEarningRows = EARNING_ROWS.filter(
    ([, field]) => (payslip[field] || 0) !== 0 || (ytd[field] || 0) !== 0
  );

  const earnings = drawColumnTable(doc, {
    x: infoX,
    width: colWidth,
    y: tableY,
    title: "Earnings",
    rows: visibleEarningRows,
    payslip,
    ytd,
  });
  const deductions = drawColumnTable(doc, {
    x: infoX + colWidth + 12,
    width: colWidth,
    y: tableY,
    title: "Deductions",
    rows: DEDUCTION_ROWS,
    payslip,
    ytd,
  });

  // PF Employer - informational only (part of CTC, not part of take-home).
  let leftBottomY = earnings.bottomY;
  const rowH = 16;
  if ((payslip.pfEmployer || 0) !== 0 || (ytd.pfEmployer || 0) !== 0) {
    doc.font("Helvetica").fontSize(9);
    doc.rect(infoX, leftBottomY, colWidth * 0.5, rowH).stroke();
    doc.rect(infoX + colWidth * 0.5, leftBottomY, colWidth * 0.25, rowH).stroke();
    doc.rect(infoX + colWidth * 0.75, leftBottomY, colWidth * 0.25, rowH).stroke();
    doc.text("PF Employer", infoX + 4, leftBottomY + 4, { width: colWidth * 0.5 - 8 });
    doc.text(money(payslip.pfEmployer), infoX + colWidth * 0.5 + 4, leftBottomY + 4, { width: colWidth * 0.25 - 8, align: "right" });
    doc.text(money(ytd.pfEmployer), infoX + colWidth * 0.75 + 4, leftBottomY + 4, { width: colWidth * 0.25 - 8, align: "right" });
    leftBottomY += rowH;
  }

  const bottomY = Math.max(leftBottomY, deductions.bottomY);

  doc.font("Helvetica-Bold").fontSize(9.5);
  doc.rect(infoX, bottomY, colWidth * 0.75, rowH).stroke();
  doc.rect(infoX + colWidth * 0.75, bottomY, colWidth * 0.25, rowH).stroke();
  doc.text("GROSS PAY", infoX + 4, bottomY + 4);
  doc.text(money(payslip.grossPay), infoX + colWidth * 0.75 + 4, bottomY + 4, { width: colWidth * 0.25 - 8, align: "right" });

  doc.rect(infoX + colWidth + 12, bottomY, colWidth * 0.75, rowH).stroke();
  doc.rect(infoX + colWidth + 12 + colWidth * 0.75, bottomY, colWidth * 0.25, rowH).stroke();
  doc.text("GROSS DEDUCTIONS", infoX + colWidth + 16, bottomY + 4);
  doc.text(money(payslip.grossDeductions), infoX + colWidth + 12 + colWidth * 0.75 + 4, bottomY + 4, {
    width: colWidth * 0.25 - 8,
    align: "right",
  });

  const netPayY = bottomY + rowH;
  doc.font("Helvetica-Bold").fontSize(9.5);
  doc.rect(infoX + colWidth + 12, netPayY, colWidth * 0.75, rowH).stroke();
  doc.rect(infoX + colWidth + 12 + colWidth * 0.75, netPayY, colWidth * 0.25, rowH).stroke();
  doc.text("NET PAY", infoX + colWidth + 16, netPayY + 4);
  doc.text(money(payslip.netPay), infoX + colWidth + 12 + colWidth * 0.75 + 4, netPayY + 4, {
    width: colWidth * 0.25 - 8,
    align: "right",
  });

  doc.font("Helvetica-Oblique").fontSize(8).text("*** This is system generated document. No signature is required. ***", infoX, netPayY + 30, {
    align: "center",
    width: pageWidth,
  });

  doc.end();
};

module.exports = { streamPayslipPdf };
