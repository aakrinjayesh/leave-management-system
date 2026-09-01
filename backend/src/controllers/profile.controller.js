const path = require("path");
const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const {
  SELF_PROFILE_EDIT_LIMIT,
  PROFILE_CHANGE_SECTIONS,
  PROFILE_CHANGE_DOCUMENTS,
  INTRO_PROMPT_KEYS,
} = require("../utils/constants");
const incomeTaxService = require("../services/incomeTax.service");
const resignationService = require("../services/resignation.service");
const { streamIncomeTaxComputationPdf } = require("../services/incomeTaxPdf.service");
const { sendResignationSubmittedEmail, sendResignationWithdrawnEmail } = require("../utils/email.util");
const notificationService = require("../services/notification.service");
const { formatDateShort } = require("../utils/formatDate.util");
const { isS3Url, uploadToS3, deleteFromS3 } = require("../utils/s3.util");
const { EMPLOYEE_DOCUMENT_DIR } = require("../config/employeeDocumentUpload");

// Document type route param (photo|pan|aadhar|bank) -> User column.
const DOC_COLUMN_BY_TYPE = {
  photo: "photoUrl",
  pan: "panDocumentUrl",
  aadhar: "aadharDocumentUrl",
  bank: "bankDocumentUrl",
};

// Uploads any files the employee attached to a profile section form to S3 and
// merges the resulting URLs into req.body (as the User column names) so they
// ride along in the same change request as the section's field edits. Only
// the document fields that belong to `section` are considered - the schema
// already stripped any URL the client tried to put in the body directly.
const attachSectionDocuments = async (req, section) => {
  const config = PROFILE_CHANGE_SECTIONS[section];
  const uploaded = [];
  for (const [column, doc] of Object.entries(PROFILE_CHANGE_DOCUMENTS)) {
    if (!config.fields.includes(column)) continue;
    const file = req.files?.[doc.uploadField]?.[0];
    if (!file) continue;
    const { url } = await uploadToS3(file, doc.folder);
    req.body[column] = url;
    uploaded.push(url);
  }
  return uploaded;
};

// Submits the section change request, cleaning up any just-uploaded files if
// the submission itself is rejected (nothing changed / one already pending).
const submitSectionWithDocs = async (req, section) => {
  const uploaded = await attachSectionDocuments(req, section);
  try {
    return await submitProfileChangeRequest(req.user.id, section, req.body);
  } catch (err) {
    for (const url of uploaded) {
      deleteFromS3(url).catch((e) => console.error("Failed to clean up abandoned profile document:", e));
    }
    throw err;
  }
};

const getMyDocument = asyncHandler(async (req, res) => {
  const column = DOC_COLUMN_BY_TYPE[req.params.type];
  if (!column) {
    throw ApiError.badRequest("Unknown document type.");
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user[column]) {
    throw ApiError.notFound("No document uploaded yet.");
  }

  if (isS3Url(user[column])) {
    return res.redirect(user[column]);
  }

  const filePath = path.join(EMPLOYEE_DOCUMENT_DIR, path.basename(user[column]));
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: "Document file not found." });
    }
  });
});

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
const notifyAdminsOfProfileChangeRequest = async (employee, sectionLabel) => {
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await notificationService.notifyMany(
      admins.map((admin) => admin.id),
      {
        type: notificationService.NOTIFICATION_TYPES.PROFILE_CHANGE_REQUESTED,
        title: "Profile change request",
        message: `${employee.firstName} ${employee.lastName} requested a change to their ${sectionLabel}. Review it on their details page.`,
        link: `/admin/users/${employee.id}/details`,
      }
    );
  } catch (err) {
    console.error("Failed to create profile change request notification:", err);
  }
};

// Normalises a stored/db value to a string so the "did this actually change?"
// comparison isn't fooled by Date objects vs ISO strings, null vs "", etc.
const normaliseForCompare = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

// Shared by all three updateMy*Info handlers - instead of writing to User, it
// parks the (already-validated) changes in a PENDING ProfileChangeRequest for
// an admin to accept or reject. Bumps the section's submission counter, and
// only one PENDING request per section is allowed at a time.
const submitProfileChangeRequest = async (userId, section, data) => {
  const config = PROFILE_CHANGE_SECTIONS[section];
  const existing = await prisma.user.findUnique({ where: { id: userId } });

  if (existing[config.countField] >= SELF_PROFILE_EDIT_LIMIT) {
    throw ApiError.forbidden(
      `You've used all ${SELF_PROFILE_EDIT_LIMIT} change requests for ${config.label}. Contact your admin to make further changes.`
    );
  }

  const alreadyPending = await prisma.profileChangeRequest.findFirst({
    where: { userId, section, status: "PENDING" },
  });
  if (alreadyPending) {
    throw ApiError.badRequest(`Your last ${config.label} change is still awaiting admin approval.`);
  }

  // Keep only the fields the employee actually provided AND that differ from
  // what's already on record - a no-op save shouldn't create a request.
  const changes = {};
  for (const field of config.fields) {
    const value = data[field];
    if (value === undefined) continue;
    if (normaliseForCompare(existing[field]) !== normaliseForCompare(value)) {
      changes[field] = value instanceof Date ? value.toISOString() : value;
    }
  }
  if (Object.keys(changes).length === 0) {
    throw ApiError.badRequest("Nothing has changed in this section.");
  }

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { [config.countField]: { increment: 1 } },
    }),
    prisma.profileChangeRequest.create({ data: { userId, section, changes } }),
  ]);

  await notifyAdminsOfProfileChangeRequest(updatedUser, config.label);

  return SELF_PROFILE_EDIT_LIMIT - updatedUser[config.countField];
};

const updateMyPersonalInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await submitSectionWithDocs(req, "PERSONAL");
  new ApiResponse(200, "Sent to admin for approval.", { editsRemaining }).send(res);
});

const updateMyStatutoryInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await submitSectionWithDocs(req, "STATUTORY");
  new ApiResponse(200, "Sent to admin for approval.", { editsRemaining }).send(res);
});

const updateMyBankInfo = asyncHandler(async (req, res) => {
  const editsRemaining = await submitSectionWithDocs(req, "BANK");
  new ApiResponse(200, "Sent to admin for approval.", { editsRemaining }).send(res);
});

const getMyProfileChangeRequests = asyncHandler(async (req, res) => {
  const requests = await prisma.profileChangeRequest.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  new ApiResponse(200, "OK", { requests }).send(res);
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

// ---- "Introduce yourself" (private, employee-managed free text) ----------

// Normalise whatever's stored (or missing) into a plain key->string map with
// an entry for every known prompt, so the frontend always gets a full shape.
const toIntroView = (stored) => {
  const source = stored && typeof stored === "object" ? stored : {};
  return Object.fromEntries(INTRO_PROMPT_KEYS.map((key) => [key, source[key] || ""]));
};

const getMyIntro = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { intro: true },
  });

  new ApiResponse(200, "OK", { intro: toIntroView(user?.intro) }).send(res);
});

// Merges the submitted answers onto whatever's stored - an omitted prompt is
// left as-is, an empty string clears just that one.
const updateMyIntro = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { intro: true },
  });

  const current = user?.intro && typeof user.intro === "object" ? user.intro : {};
  const next = { ...current };

  for (const key of INTRO_PROMPT_KEYS) {
    if (req.body[key] === undefined) continue;
    if (req.body[key] === "") delete next[key];
    else next[key] = req.body[key];
  }

  await prisma.user.update({ where: { id: req.user.id }, data: { intro: next } });

  new ApiResponse(200, "Saved.", { intro: toIntroView(next) }).send(res);
});

module.exports = {
  markAnniversaryCelebrationSeen,
  markBirthdayCelebrationSeen,
  getMyProfileChangeRequests,
  getMyIntro,
  updateMyIntro,
  updateMyPersonalInfo,
  updateMyStatutoryInfo,
  updateMyBankInfo,
  getMyPhoto,
  getMyDocument,
  getMyIncomeTaxComputation,
  listMyIncomeTaxComputationGenerations,
  downloadMyIncomeTaxComputationPdf,
  submitMyResignation,
  getMyResignation,
  withdrawMyResignation,
};
