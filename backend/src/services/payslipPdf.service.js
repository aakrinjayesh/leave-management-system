const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { amountInWordsInr } = require("../utils/numberToWords.util");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "Site No: 86, VSL Srinidhi Greenage, Neriga Village, Sarjapura Hobli, Anekal Taluk,\nBengaluru, Karnataka 562125, India";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

// Brand palette from the payslip template.
const PURPLE = "#9B45D6";
const LAVENDER = "#F5EBFB";
const ORANGE = "#EE8A1E";
const RED = "#D9262A";
const TEXT = "#222222";
const MUTED = "#5F5F5F";

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
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const money = (value) => (value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lineMoney = (value) => (value ? money(value) : "-");
const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-");
const dash = (value) => (value ? value : "-");
const TAX_REGIME_LABELS = { OLD: "Old Tax Regime", NEW: "New Tax Regime" };
const GENDER_LABELS = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

// "01 Nov 2026 - 30 Nov 2026"
const payPeriodLabel = (year, month) => {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const m = MONTH_SHORT[month - 1];
  return `01 ${m} ${year} - ${lastDay} ${m} ${year}`;
};

// "2026-27" for an April-start fiscal year; just "2026" when it starts in January.
const financialYearLabel = (year, month, fiscalYearStartMonth) => {
  const fy = month >= fiscalYearStartMonth ? year : year - 1;
  return fiscalYearStartMonth === 1 ? String(fy) : `${fy}-${String(fy + 1).slice(-2)}`;
};

const amountInWords = (value) => (value < 0 ? `Minus ${amountInWordsInr(-value)}` : amountInWordsInr(value));

// The template's first four earnings always show; the rest only when the
// structure actually uses them (non-zero this month or YTD).
const EARNING_ROWS = [
  { label: "Basic", field: "basic", always: true },
  { label: "House Rent Allowance", field: "hra", always: true },
  { label: "Conveyance Allowance", field: "conveyance", always: true },
  { label: "Special Allowance", field: "specialAllowance", always: true },
  { label: "Leave Travel Allowance", field: "lta" },
  { label: "Guaranteed Allowance", field: "guaranteedAllowance" },
  { label: "Annual Bonus Pay", field: "annualBonusPay" },
];

const DEDUCTION_ROWS = [
  { label: "Provident Fund", field: "pfEmployee" },
  { label: "Professional Tax", field: "professionalTax" },
  { label: "Income Tax (TDS)", field: "tds" },
  { label: "Loss of Pay", field: "lopAmount" },
];

// Single-line text vertically centred in a cell, truncated with an ellipsis
// if it's too wide.
const cellText = (
  doc,
  text,
  x,
  y,
  w,
  h,
  { font = "Helvetica", size = 9, color = TEXT, align = "left", padX = 10, padRight = padX } = {}
) => {
  doc.font(font).fontSize(size).fillColor(color);
  const lineH = doc.currentLineHeight(true);
  doc.text(String(text), x + padX, y + (h - lineH) / 2 + 1, {
    width: w - padX - padRight,
    height: lineH,
    align,
    ellipsis: true,
  });
};

// Thin orange / red / purple band, as at the top and bottom of the template.
const drawBrandStripe = (doc, y) => {
  const third = doc.page.width / 3;
  [ORANGE, RED, PURPLE].forEach((color, i) => {
    doc.rect(third * i, y, third + 0.5, 4).fill(color);
  });
};

// Renders a payslip PDF matching the company's payslip template and pipes it
// to the given writable stream (an Express response or a PassThrough).
// fiscalYearStartMonth (1-12, CompanySettings) drives the Financial Year label.
const streamPayslipPdf = ({ payslip, employee, ytd, fiscalYearStartMonth = 4 }, res) => {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  const left = doc.page.margins.left;
  const pageWidth = doc.page.width - left - doc.page.margins.right;
  const half = pageWidth / 2;

  drawBrandStripe(doc, 0);
  drawBrandStripe(doc, doc.page.height - 4);

  // ---- Header: logo + company name / address ----------------------------
  const headerTop = 36;
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, left + 6, headerTop, { fit: [52, 46], align: "center", valign: "center" });
  }
  const textX = left + 68;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor(PURPLE)
    .text(COMPANY_NAME, textX, headerTop + 4, { width: pageWidth - 68, lineBreak: false });
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(MUTED)
    .text(COMPANY_ADDRESS, textX, headerTop + 24, { width: pageWidth - 68, lineGap: 1 });

  // ---- Purple title banner ----------------------------------------------
  const bannerY = 92;
  const bannerH = 26;
  doc.rect(left, bannerY, pageWidth, bannerH).fill(PURPLE);
  cellText(doc, `PAYSLIP FOR THE MONTH OF ${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`, left, bannerY, pageWidth, bannerH, {
    font: "Helvetica-Bold",
    size: 11,
    color: "#FFFFFF",
    align: "center",
  });

  // ---- Employee details grid (lavender label | value, two sides) --------
  const leftRows = [
    ["Employee Name", [employee.firstName, employee.lastName].filter(Boolean).join(" ") || "-"],
    ["Employee No", dash(employee.employeeCode)],
    ["Designation", dash(employee.designation)],
    ["Date of Joining", formatDate(employee.joiningDate)],
    ["Location", dash(employee.location)],
    ["Gender", GENDER_LABELS[employee.gender] || "-"],
    ["Standard Days", dash(payslip.standardDays)],
    ["Days Worked", dash(payslip.daysWorked)],
  ];
  const rightRows = [
    ["PAN", dash(employee.pan)],
    ["UAN", dash(employee.uan)],
    ["PF No", dash(employee.pfNumber)],
    ["Bank", dash(employee.bankName)],
    ["Bank A/c No", dash(employee.bankAccountNumber)],
    ["Tax Regime", TAX_REGIME_LABELS[employee.taxRegime] || "-"],
    ["Pay Period", payPeriodLabel(payslip.year, payslip.month)],
    ["Financial Year", financialYearLabel(payslip.year, payslip.month, fiscalYearStartMonth)],
  ];

  const gridY = bannerY + bannerH + 10;
  const gridRowH = 20;
  const labelW = 92;
  const gridH = gridRowH * leftRows.length;
  doc.rect(left, gridY, labelW, gridH).fill(LAVENDER);
  doc.rect(left + half, gridY, labelW, gridH).fill(LAVENDER);

  [
    [leftRows, left],
    [rightRows, left + half],
  ].forEach(([rows, x]) => {
    rows.forEach(([label, value], i) => {
      const rowY = gridY + i * gridRowH;
      cellText(doc, label, x, rowY, labelW, gridRowH, { color: MUTED });
      cellText(doc, value, x + labelW, rowY, half - labelW, gridRowH);
    });
  });

  // ---- Earnings / Deductions table --------------------------------------
  const rowH = 20;
  // Sized so the longest label ("Leave Travel Allowance") and a bold
  // "12,34,567.00" YTD both fit without being cut off.
  const descW = 106;
  const amtW = (half - descW) / 2;
  const ytdW = amtW;
  let y = gridY + gridH + 12;

  const drawRow = (x, cells, opts) => {
    cellText(doc, cells[0], x, y, descW, rowH, { ...opts, padRight: 2 });
    cellText(doc, cells[1], x + descW, y, amtW, rowH, { ...opts, align: "right", padX: 2 });
    cellText(doc, cells[2], x + descW + amtW, y, ytdW, rowH, { ...opts, align: "right", padX: 2, padRight: 10 });
  };

  doc.rect(left, y, pageWidth, rowH).fill(LAVENDER);
  const headerOpts = { font: "Helvetica-Bold", size: 9.5, color: PURPLE };
  drawRow(left, ["Earnings", "Amount", "YTD"], headerOpts);
  drawRow(left + half, ["Deductions", "Amount", "YTD"], headerOpts);
  y += rowH;

  const earnings = EARNING_ROWS.filter(
    ({ field, always }) => always || (payslip[field] || 0) !== 0 || (ytd[field] || 0) !== 0
  );
  const lineCount = Math.max(earnings.length, DEDUCTION_ROWS.length);
  for (let i = 0; i < lineCount; i += 1) {
    const e = earnings[i];
    const d = DEDUCTION_ROWS[i];
    if (e) drawRow(left, [e.label, lineMoney(payslip[e.field]), lineMoney(ytd[e.field])]);
    if (d) drawRow(left + half, [d.label, lineMoney(payslip[d.field]), lineMoney(ytd[d.field])]);
    y += rowH;
  }

  // PF Employer is intentionally not shown - it's part of CTC, not take-home.
  doc.rect(left, y, pageWidth, rowH).fill(LAVENDER);
  const totalOpts = { font: "Helvetica-Bold", size: 9.5 };
  drawRow(left, ["Gross Earnings", money(payslip.grossPay), money(ytd.grossPay)], totalOpts);
  drawRow(left + half, ["Total Deductions", money(payslip.grossDeductions), money(ytd.grossDeductions)], totalOpts);
  y += rowH;

  // ---- Net pay + amount in words (lavender label | value) ---------------
  y += 12;
  const netRowH = 23;
  const words = amountInWords(payslip.netPay);
  const valueX = left + half;
  const valueW = half;
  doc.font("Helvetica").fontSize(9);
  const wordsH = doc.heightOfString(words, { width: valueW - 20 });
  const wordsRowH = Math.max(netRowH, wordsH + 12);

  doc.rect(left, y, half, netRowH + wordsRowH).fill(LAVENDER);
  const netLabelOpts = { font: "Helvetica-Bold", size: 9.5, color: PURPLE };
  cellText(doc, "Net Pay (Gross Earnings - Total Deductions)", left, y, half, netRowH, netLabelOpts);
  cellText(doc, money(payslip.netPay), valueX, y, valueW, netRowH, { font: "Helvetica-Bold", size: 11 });
  y += netRowH;

  cellText(doc, "Amount in Words", left, y, half, netRowH, netLabelOpts);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(TEXT)
    .text(words, valueX + 10, y + (wordsRowH - wordsH) / 2 + 1, { width: valueW - 20 });
  y += wordsRowH;

  // ---- Footer -----------------------------------------------------------
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor(MUTED)
    .text("This is a system-generated payslip and does not require a signature.", left, y + 18, {
      width: pageWidth,
      align: "center",
    });

  doc.end();
};

module.exports = { streamPayslipPdf };
