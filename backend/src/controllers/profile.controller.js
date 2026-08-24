const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { SELF_PROFILE_EDIT_LIMIT } = require("../utils/constants");
const incomeTaxService = require("../services/incomeTax.service");
const resignationService = require("../services/resignation.service");
const { streamIncomeTaxComputationPdf } = require("../services/incomeTaxPdf.service");
const { sendResignationSubmittedEmail, sendResignationWithdrawnEmail } = require("../utils/email.util");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { isS3Url } = require("../utils/s3.util");
const { EMPLOYEE_DOCUMENT_DIR } = require("../config/employeeDocumentUpload");

// Self-service version of admin's downloadUserDocument (type "photo" only) -
// admin is still the only one who can upload/replace it (see
// adminEmployeeDocs.controller.js), but everyone needs to be able to fetch
// their OWN photo to show on their own dashboard.
const getMyPhoto = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.photoUrl) {
    throw ApiError.notFound("No photo uploaded yet.");
  }

  if (isS3Url(user.photoUrl)) {
    return res.redirect(user.photoUrl);
  }

  // Legacy photo uploaded before the S3 migration - still on local disk.
  const filePath = path.join(EMPLOYEE_DOCUMENT_DIR, path.basename(user.photoUrl));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Photo file not found." });
    }
  });
});

// Lets every active admin know an employee changed their own profile - the
// employee's edit applies immediately (no approval step), this is just a
// heads-up so admin can review it if something looks off.
const notifyAdminsOfProfileSelfEdit = async (employee, sectionLabel) => {
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await notificationService.notifyMany(
      admins.map((admin) => admin.id),
      {
        type: notificationService.NOTIFICATION_TYPES.PROFILE_UPDATED,
        title: "Employee updated their profile",
        message: `${employee.firstName} ${employee.lastName} updated their ${sectionLabel}.`,
      }
    );
  } catch (err) {
    console.error("Failed to create profile self-edit notification:", err);
  }
};

// Shared by all three updateMy*Info handlers below - checks the section's
// edit count against SELF_PROFILE_EDIT_LIMIT, applies the (already-validated)
// changes, and bumps the counter. Undefined fields in `data` are left
// untouched by Prisma, so a field the employee didn't fill in on this save
// just keeps its existing value.
const applySelfEdit = async (userId, countField, data, sectionLabel) => {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing[countField] >= SELF_PROFILE_EDIT_LIMIT) {
    throw ApiError.forbidden(
      `You've used all ${SELF_PROFILE_EDIT_LIMIT} edits allowed for ${sectionLabel}. Contact your admin to make further changes.`
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { ...data, [countField]: { increment: 1 } },
  });

  await notifyAdminsOfProfileSelfEdit(user, sectionLabel);

  return SELF_PROFILE_EDIT_LIMIT - user[countField];
};

const updateMyPersonalInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await applySelfEdit(req.user.id, "personalInfoEditCount", req.body, "Personal Information");

  new ApiResponse(200, "Personal information updated.", { editsRemaining }).send(res);
});

const updateMyStatutoryInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await applySelfEdit(req.user.id, "statutoryInfoEditCount", req.body, "Statutory Information");

  new ApiResponse(200, "Statutory information updated.", { editsRemaining }).send(res);
});

const updateMyBankInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await applySelfEdit(req.user.id, "bankInfoEditCount", req.body, "Bank Information");

  new ApiResponse(200, "Bank information updated.", { editsRemaining }).send(res);
});

// Every active admin, plus this employee's own active manager if they have
// one - the shared recipient set for resignation submit/withdraw notices
// (dedup'd by id, since a manager could in theory also be an admin).
const getResignationNoticeRecipients = async (employee) => {
  const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
  const recipientsById = new Map(admins.map((admin) => [admin.id, admin]));

  if (employee.managerId) {
    const manager = await prisma.user.findFirst({ where: { id: employee.managerId, status: "ACTIVE" } });
    if (manager) recipientsById.set(manager.id, manager);
  }

  return [...recipientsById.values()];
};

// Completed years since joining, computed server-side (not trusted from the
// client) so the stored "last celebrated" value can't be spoofed.
const getYearsCompleted = (joiningDate) => {
  const start = new Date(joiningDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const hasHadAnniversaryThisYear =
    now.getMonth() > start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());
  if (!hasHadAnniversaryThisYear) years -= 1;
  return years;
};

// Records the highest completed-years count this employee has been shown a
// celebration for, so the next call only re-fires once a new anniversary is
// actually reached (1 year, then 2, then 3...), not on every profile visit.
const markAnniversaryCelebrationSeen = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!existing?.joiningDate) {
    throw ApiError.badRequest("No joining date on file.");
  }

  const years = getYearsCompleted(existing.joiningDate);
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { lastAnniversaryCelebratedYears: years },
  });

  new ApiResponse(200, "OK", { lastAnniversaryCelebratedYears: user.lastAnniversaryCelebratedYears }).send(res);
});

// Records that this employee's birthday celebration overlay has been shown
// for the current year, so it doesn't replay on later dashboard visits the
// same year.
const markBirthdayCelebrationSeen = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { lastBirthdayCelebratedYear: new Date().getFullYear() },
  });

  new ApiResponse(200, "OK", { lastBirthdayCelebratedYear: user.lastBirthdayCelebratedYear }).send(res);
});

// Employee's own read-only Income Tax Computation, scoped to their own
// account only - same computation logic admin uses, just locked to the
// requester's own userId so no one can view anyone else's.
const getMyIncomeTaxComputation = asyncHandler(async (req, res) => {
  const financialYear = Number(req.query.financialYear);

  const statement = await incomeTaxService.computeIncomeTaxStatement(req.user.id, financialYear);

  new ApiResponse(200, "OK", { statement }).send(res);
});

// Every saved generation for the logged-in employee's own account only -
// read-only, matches how employees can view (but not create) their own past
// payslips; only admin can generate new ones.
const listMyIncomeTaxComputationGenerations = asyncHandler(async (req, res) => {
  const generations = await incomeTaxService.listIncomeTaxComputationGenerations(req.user.id);

  new ApiResponse(200, "OK", { generations }).send(res);
});

const downloadMyIncomeTaxComputationPdf = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const generation = await incomeTaxService.getIncomeTaxComputationGeneration(id);
  if (!generation || generation.userId !== req.user.id) {
    throw ApiError.notFound("Income tax computation not found.");
  }

  if (generation.pdfUrl) {
    return res.redirect(generation.pdfUrl);
  }

  // Legacy generation created before PDFs were stored to S3 - render on demand.
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="income-tax-computation-${generation.user.firstName}-FY${generation.financialYear}.pdf"`
  );
  streamIncomeTaxComputationPdf({ generation, employee: generation.user }, res);
});

const submitMyResignation = asyncHandler(async (req, res) => {
  const { reason, proposedLastWorkingDate } = req.body;

  const resignation = await resignationService.submitResignation(req.user.id, reason, proposedLastWorkingDate);

  new ApiResponse(201, "Resignation submitted.", { resignation }).send(res);

  // Notify every active admin - sent after the response so the employee
  // doesn't wait on the email round-trips; failures here shouldn't fail the
  // submission itself.
  const employeeName = `${req.user.firstName} ${req.user.lastName}`;
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
    for (const admin of admins) {
      await sendResignationSubmittedEmail({
        to: admin.email,
        recipientFirstName: admin.firstName,
        employeeName,
        proposedLastWorkingDate,
        reason,
      });
    }
  } catch (err) {
    console.error("Failed to send resignation submitted email:", err);
  }

  // In-app notification goes to both the manager (view-only on resignations)
  // and every active admin (who can actually accept/reject).
  try {
    const recipientIds = new Set();
    const admins = await prisma.user.findMany({
      where: { userType: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    admins.forEach((admin) => recipientIds.add(admin.id));

    if (req.user.managerId) {
      const manager = await prisma.user.findFirst({ where: { id: req.user.managerId, status: "ACTIVE" } });
      if (manager) recipientIds.add(manager.id);
    }

    await notificationService.notifyMany([...recipientIds], {
      type: notificationService.NOTIFICATION_TYPES.RESIGNATION_SUBMITTED,
      title: "New resignation submitted",
      message: `${employeeName} submitted their resignation, proposed last working day ${formatDateShort(
        proposedLastWorkingDate
      )}.`,
    });
  } catch (err) {
    console.error("Failed to create resignation submitted notification:", err);
  }
});

const getMyResignation = asyncHandler(async (req, res) => {
  const resignation = await resignationService.getMyResignation(req.user.id);

  new ApiResponse(200, "OK", { resignation }).send(res);
});

const withdrawMyResignation = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const resignation = await resignationService.withdrawResignation(req.user.id, id);

  new ApiResponse(200, "Resignation withdrawn.", { resignation }).send(res);

  // Notifies the same audience as the submission itself (every active admin
  // + this employee's manager) - sent after the response so the employee
  // doesn't wait on the round-trips; failures here shouldn't fail the
  // withdrawal itself.
  const employeeName = `${req.user.firstName} ${req.user.lastName}`;
  try {
    const recipients = await getResignationNoticeRecipients(req.user);

    for (const recipient of recipients) {
      try {
        await sendResignationWithdrawnEmail({
          to: recipient.email,
          recipientFirstName: recipient.firstName,
          employeeName,
        });
      } catch (err) {
        console.error("Failed to send resignation withdrawn email:", err);
      }

      try {
        await notificationService.notify({
          userId: recipient.id,
          type: notificationService.NOTIFICATION_TYPES.RESIGNATION_WITHDRAWN,
          title: "Resignation withdrawn",
          message: `${employeeName} has withdrawn their resignation.`,
        });
      } catch (err) {
        console.error("Failed to create resignation withdrawn notification:", err);
      }
    }
  } catch (err) {
    console.error("Failed to look up recipients for resignation withdrawn notice:", err);
  }
});

module.exports = {
  markAnniversaryCelebrationSeen,
  markBirthdayCelebrationSeen,
  updateMyPersonalInfo,
  updateMyStatutoryInfo,
  updateMyBankInfo,
  getMyPhoto,
  getMyIncomeTaxComputation,
  listMyIncomeTaxComputationGenerations,
  downloadMyIncomeTaxComputationPdf,
  submitMyResignation,
  getMyResignation,
  withdrawMyResignation,
};
