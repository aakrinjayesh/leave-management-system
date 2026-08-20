const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { streamOfferLetterPdf } = require("../services/offerLetterPdf.service");
const { renderPdfToBuffer } = require("../utils/pdfBuffer.util");
const { uploadToS3 } = require("../utils/s3.util");

// Every save creates a new version - nothing is ever overwritten, so a
// regenerated letter (e.g. after a CTC negotiation) doesn't lose the earlier
// one. Same pattern as ExitRecord/recordExit.
const createOfferLetter = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { offerDate, letterText } = req.body;

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  const offerLetter = await prisma.offerLetter.create({
    data: { userId, offerDate, letterText, generatedById: req.user.id },
  });

  const buffer = await renderPdfToBuffer(streamOfferLetterPdf, { offerLetter });
  const { url } = await uploadToS3(
    { buffer, originalname: `offer-letter-${employee.firstName}-${employee.lastName}.pdf`, mimetype: "application/pdf" },
    "offer-letters"
  );
  // Every save is its own permanent version (see the comment above) - so
  // unlike payslips, there's no previous version of THIS row's PDF to clean
  // up here.
  const updated = await prisma.offerLetter.update({ where: { id: offerLetter.id }, data: { pdfUrl: url } });

  new ApiResponse(201, "Offer letter saved.", { offerLetter: updated }).send(res);
});

const listOfferLetters = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  const offerLetters = await prisma.offerLetter.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { generatedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  new ApiResponse(200, "OK", { offerLetters }).send(res);
});

const downloadOfferLetterPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });
  if (!offerLetter) {
    throw ApiError.notFound("Offer letter not found.");
  }

  if (offerLetter.pdfUrl) {
    return res.redirect(offerLetter.pdfUrl);
  }

  // Legacy offer letter generated before PDFs were stored to S3 - render on demand.
  const employee = await prisma.user.findUnique({ where: { id: offerLetter.userId } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="offer-letter-${employee.firstName}-${employee.lastName}.pdf"`
  );
  streamOfferLetterPdf({ employee, offerLetter }, res);
});

// Renders whatever text is currently in the editor as a PDF, without saving
// anything - lets admin see exactly how it'll look before committing to it.
const previewOfferLetterPdf = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const { letterText } = req.body;

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    throw ApiError.notFound("Account not found.");
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "inline; filename=\"offer-letter-preview.pdf\"");
  streamOfferLetterPdf({ employee, offerLetter: { letterText } }, res);
});

const deleteOfferLetter = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const offerLetter = await prisma.offerLetter.findUnique({ where: { id } });
  if (!offerLetter) {
    throw ApiError.notFound("Offer letter not found.");
  }

  await prisma.offerLetter.delete({ where: { id } });

  new ApiResponse(200, "Offer letter deleted.").send(res);
});

module.exports = {
  createOfferLetter,
  listOfferLetters,
  downloadOfferLetterPdf,
  previewOfferLetterPdf,
  deleteOfferLetter,
};
