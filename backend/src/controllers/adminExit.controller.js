const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { USER_STATUS } = require("../utils/constants");
const { streamRelievingLetterPdf } = require("../services/relievingLetterPdf.service");
const { sendExitNotificationEmail } = require("../utils/email.util");

// Replaces the plain "deactivate" flow - records a permanent ExitRecord (so
// the relieving letter can always be re-downloaded later, even across
// reactivate/rehire cycles) and marks the account INACTIVE in one go.
const recordExit = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { exitDate, relievingLetterText } = req.body;

  if (id === req.user.id) {
    throw ApiError.badRequest("You can't exit your own account.");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw ApiError.notFound("Account not found.");
  }

  const [exitRecord, user] = await prisma.$transaction([
    prisma.exitRecord.create({
      data: { userId: id, exitDate, relievingLetterText, recordedById: req.user.id },
    }),
    prisma.user.update({ where: { id }, data: { status: USER_STATUS.INACTIVE, exitDate } }),
  ]);

  new ApiResponse(200, "Account exited.", { user, exitRecord }).send(res);

  // Notify the exited employee, their manager, and every other active admin -
  // sent after the response so the acting admin doesn't wait on the email
  // round-trips; failures here shouldn't fail the exit itself.
  try {
    const employeeName = `${user.firstName} ${user.lastName}`;
    const recipients = [];

    recipients.push({ email: user.email, firstName: user.firstName, isSelf: true });

    if (user.managerId) {
      const manager = await prisma.user.findFirst({ where: { id: user.managerId, status: USER_STATUS.ACTIVE } });
      if (manager) recipients.push({ email: manager.email, firstName: manager.firstName, isSelf: false });
    }

    const otherAdmins = await prisma.user.findMany({
      where: { userType: "ADMIN", status: USER_STATUS.ACTIVE, id: { not: req.user.id } },
    });
    for (const admin of otherAdmins) {
      recipients.push({ email: admin.email, firstName: admin.firstName, isSelf: false });
    }

    for (const recipient of recipients) {
      await sendExitNotificationEmail({
        to: recipient.email,
        recipientFirstName: recipient.firstName,
        employeeName,
        exitDate,
        isSelf: recipient.isSelf,
      });
    }
  } catch (err) {
    console.error("Failed to send exit notification email:", err);
  }
});

const listExitRecords = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);
  const records = await prisma.exitRecord.findMany({
    where: { userId },
    orderBy: { exitDate: "desc" },
    include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  new ApiResponse(200, "OK", { records }).send(res);
});

const downloadRelievingLetterPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const exitRecord = await prisma.exitRecord.findUnique({ where: { id } });
  if (!exitRecord) {
    throw ApiError.notFound("Exit record not found.");
  }

  const employee = await prisma.user.findUnique({ where: { id: exitRecord.userId } });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="relieving-letter-${employee.firstName}-${employee.lastName}.pdf"`
  );
  streamRelievingLetterPdf({ employee, exitRecord }, res);
});

module.exports = { recordExit, listExitRecords, downloadRelievingLetterPdf };
