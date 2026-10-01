const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  ImageRun,
  BorderStyle,
  WidthType,
  AlignmentType,
  VerticalAlign,
} = require("docx");

const COMPANY_NAME = "AAKRIN CONSULTING SERVICES PRIVATE LIMITED";
const COMPANY_ADDRESS =
  "SITE NO: 86, VSL SRINIDHI GREENAGE, NERIGA VILLAGE, SARJAPURA HOBLI, ANEKAL TALUK, BENGALURU, KARNATAKA 562125, INDIA.";
const COMPANY_CIN = "U72900KA2023PTC170648";
const COMPANY_GSTIN = "29AAYCA2765K1ZT";
const COMPANY_PAN = "AAYCA2765K";
const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo.png");

// Same defaults as invoicePdf.service.js, kept in sync manually - duplicated
// rather than imported so this file has no dependency on PDFKit at all.
const DEFAULT_DECLARATION =
  "We declare that Invoice shows the actual price of the goods/ Services, described and that all particulars are true and correct. If you have any questions or concerns regarding this invoice, please contact krishna@aakrin.com or Accounts@aakrin.com";
const DEFAULT_PAYMENT_ADVICE = "Payment is due within 15 days from the date of this invoice.";

const money = (value) =>
  (value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const run = (text, opts = {}) => new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size || 18 });
const para = (text, opts = {}) =>
  new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 40 },
    children: [run(text, opts)],
  });

const boxCell = (children, { width, columnSpan, align } = {}) =>
  new TableCell({
    children: Array.isArray(children) ? children : [children],
    borders: CELL_BORDERS,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });

const fullWidthTable = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });

const detectImageType = (buffer) => {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  return null;
};

// Builds the same Tax Invoice content as invoicePdf.service.js's
// streamInvoicePdf, but as a .docx - the admin's alternative "Save as" format.
// No watermark (the docx library has no equivalent to PDFKit's low-opacity
// background image without pre-baking a faded PNG, so it's left out here
// rather than faked); everything else - header/footer, Bill To, services
// table, totals, bank details, declaration + signature - mirrors the PDF.
const buildInvoiceDocxBuffer = async ({ invoice, signatureBuffer }) => {
  const hasLogo = fs.existsSync(LOGO_PATH);
  const headerChildren = [];
  if (hasLogo) {
    const logoData = fs.readFileSync(LOGO_PATH);
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: "png", data: logoData, transformation: { width: 50, height: 50 } })],
      })
    );
  }
  headerChildren.push(
    para(COMPANY_NAME, { bold: true, size: 26, align: AlignmentType.CENTER }),
    para(COMPANY_ADDRESS, { size: 15, align: AlignmentType.CENTER }),
    para(`PAN: ${COMPANY_PAN}, CIN: ${COMPANY_CIN}, GST: ${COMPANY_GSTIN}`, { size: 15, align: AlignmentType.CENTER })
  );

  const footerChildren = [
    para(
      `Reg Office: ${COMPANY_ADDRESS} PAN: ${COMPANY_PAN}, CIN: ${COMPANY_CIN}, GST: ${COMPANY_GSTIN}.`,
      { italics: true, size: 13, align: AlignmentType.CENTER, spacingAfter: 0 }
    ),
  ];

  const body = [];

  body.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 200 },
      children: [run("TAX INVOICE", { bold: true, size: 26 })],
    })
  );

  // Invoice No / Date
  body.push(
    fullWidthTable([
      new TableRow({
        children: [
          boxCell(para(`Invoice No: ${invoice.invoiceNo}`, { bold: true, spacingAfter: 0 }), { width: 50 }),
          boxCell(para(`Invoice Date: ${formatDate(invoice.invoiceDate)}`, { bold: true, spacingAfter: 0 }), { width: 50 }),
        ],
      }),
    ])
  );

  body.push(para("", { spacingAfter: 60 }));
  body.push(para("Bill To", { bold: true, size: 19, spacingAfter: 40 }));

  const billToLines = [para(invoice.clientFullName, { bold: true, size: 21, spacingAfter: 30 })];
  if (invoice.clientAddress) billToLines.push(para(invoice.clientAddress, { size: 18, spacingAfter: 30 }));
  if (invoice.clientGstNumber) billToLines.push(para(`GSTIN: ${invoice.clientGstNumber}`, { size: 18, spacingAfter: 30 }));
  billToLines.push(para(`Place of Supply: ${invoice.clientState || "-"}`, { size: 18, spacingAfter: 0 }));

  body.push(fullWidthTable([new TableRow({ children: [boxCell(billToLines, { width: 100 })] })]));

  body.push(para("", { spacingAfter: 60 }));

  const paymentAdviceText = invoice.paymentAdviceText || DEFAULT_PAYMENT_ADVICE;
  body.push(
    fullWidthTable([
      new TableRow({
        children: [boxCell(para(`Payment Advice: ${paymentAdviceText}`, { size: 18, spacingAfter: 0 }), { width: 100 })],
      }),
    ])
  );

  body.push(para("", { spacingAfter: 60 }));

  // Services table - HSN appended into the description cell, same as the PDF.
  const descText = invoice.hsnCode ? `${invoice.description}\n\nHSN: ${invoice.hsnCode}` : invoice.description;
  const descParagraphs = descText.split("\n").map((line) => para(line || " ", { size: 18, spacingAfter: 20 }));

  const serviceRows = [
    new TableRow({
      children: [
        boxCell(para("S No", { bold: true, align: AlignmentType.CENTER, spacingAfter: 0 }), { width: 8 }),
        boxCell(para("Description of Services", { bold: true, spacingAfter: 0 }), { width: 62 }),
        boxCell(para("Total Amount INR", { bold: true, align: AlignmentType.RIGHT, spacingAfter: 0 }), { width: 30 }),
      ],
    }),
    new TableRow({
      children: [
        boxCell(para("1", { align: AlignmentType.CENTER, spacingAfter: 0 }), { width: 8 }),
        boxCell(descParagraphs, { width: 62 }),
        boxCell(para(money(invoice.totalTaxableValue), { align: AlignmentType.RIGHT, spacingAfter: 0 }), { width: 30 }),
      ],
    }),
    new TableRow({
      children: [
        boxCell(para("Total Taxable Value", { bold: true, align: AlignmentType.RIGHT, spacingAfter: 0 }), {
          width: 70,
          columnSpan: 2,
        }),
        boxCell(para(money(invoice.totalTaxableValue), { bold: true, align: AlignmentType.RIGHT, spacingAfter: 0 }), {
          width: 30,
        }),
      ],
    }),
  ];

  const taxRows =
    invoice.taxType === "IGST"
      ? [["IGST @ 18% of Total Taxable Value", invoice.igstAmount]]
      : [
          ["CGST @ 9% of Total Taxable Value", invoice.cgstAmount],
          ["SGST @ 9% of Total Taxable Value", invoice.sgstAmount],
        ];
  for (const [label, amount] of taxRows) {
    serviceRows.push(
      new TableRow({
        children: [
          boxCell(para(label, { align: AlignmentType.RIGHT, spacingAfter: 0 }), { width: 70, columnSpan: 2 }),
          boxCell(para(money(amount), { align: AlignmentType.RIGHT, spacingAfter: 0 }), { width: 30 }),
        ],
      })
    );
  }

  serviceRows.push(
    new TableRow({
      children: [
        boxCell(para("Total Invoice Value", { bold: true, align: AlignmentType.RIGHT, size: 20, spacingAfter: 0 }), {
          width: 70,
          columnSpan: 2,
        }),
        boxCell(
          para(`INR ${money(invoice.totalInvoiceValue)}`, { bold: true, align: AlignmentType.RIGHT, size: 20, spacingAfter: 0 }),
          { width: 30 }
        ),
      ],
    })
  );

  body.push(fullWidthTable(serviceRows));
  body.push(para(`Amount in Words: ${invoice.amountInWords}`, { italics: true, size: 17, spacingAfter: 120 }));

  const hasBankDetails = invoice.bankName || invoice.bankAccountNumber || invoice.bankIfscCode || invoice.bankAccountName;
  if (hasBankDetails) {
    body.push(para("Kindly Make the Payment to :", { bold: true, size: 19, spacingAfter: 40 }));
    const bankLines = [
      para(`Account Name: ${invoice.bankAccountName || COMPANY_NAME}`, { size: 18, spacingAfter: 30 }),
      invoice.bankName ? para(`Bank Name: ${invoice.bankName}`, { size: 18, spacingAfter: 30 }) : null,
      invoice.bankAccountNumber ? para(`Account Number: ${invoice.bankAccountNumber}`, { size: 18, spacingAfter: 30 }) : null,
      invoice.bankIfscCode ? para(`IFSC Code: ${invoice.bankIfscCode}`, { size: 18, spacingAfter: 0 }) : null,
    ].filter(Boolean);
    body.push(fullWidthTable([new TableRow({ children: [boxCell(bankLines, { width: 100 })] })]));
    body.push(para("", { spacingAfter: 60 }));
  }

  const declarationText = invoice.declarationText || DEFAULT_DECLARATION;
  const signatureChildren = [para(`For ${COMPANY_NAME}`, { align: AlignmentType.CENTER, size: 18, spacingAfter: 200 })];
  const imageType = signatureBuffer ? detectImageType(signatureBuffer) : null;
  if (signatureBuffer && imageType) {
    try {
      signatureChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new ImageRun({ type: imageType, data: signatureBuffer, transformation: { width: 90, height: 30 } })],
        })
      );
    } catch (err) {
      console.error("Failed to embed signature image in invoice Word doc:", err);
    }
  } else {
    signatureChildren.push(para("", { spacingAfter: 200 }));
  }
  signatureChildren.push(para("Authorized Signatory", { align: AlignmentType.CENTER, size: 18, spacingAfter: 0 }));

  body.push(
    fullWidthTable([
      new TableRow({
        children: [
          boxCell(
            [
              para("Declaration:", { bold: true, size: 18, spacingAfter: 30 }),
              para(declarationText, { size: 16, spacingAfter: 0 }),
            ],
            { width: 65 }
          ),
          boxCell(signatureChildren, { width: 35 }),
        ],
      }),
    ])
  );

  const doc = new Document({
    sections: [
      {
        properties: { page: { margins: { top: 700, bottom: 700, left: 700, right: 700 } } },
        headers: { default: new Header({ children: headerChildren }) },
        footers: { default: new Footer({ children: footerChildren }) },
        children: body,
      },
    ],
  });

  return Packer.toBuffer(doc);
};

module.exports = { buildInvoiceDocxBuffer };
