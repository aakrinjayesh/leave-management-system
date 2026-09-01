const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const notificationService = require("../services/notification.service");
const { deleteFromS3 } = require("../utils/s3.util");
const {
  PROFILE_CHANGE_SECTIONS,
  PROFILE_CHANGE_DATE_FIELDS,
  PROFILE_CHANGE_DOCUMENT_FIELDS,
} = require("../utils/constants");

const normalise = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

// Attaches, per changed field, the value currently on record so the admin UI
// can show a "current -> requested" diff.
const withDiff = (request, user) => ({
  ...request,
  section: request.section,
  sectionLabel: PROFILE_CHANGE_SECTIONS[request.section]?.label ?? request.section,
  fields: Object.entries(request.changes || {}).map(([field, requested]) => ({
    field,
    current: normalise(user?.[field]),
    requested,
    isDocument: PROFILE_CHANGE_DOCUMENT_FIELDS.has(field),
  })),
});

const listForUser = asyncHandler(async (req, res) => {
  const userId = Number(req.params.id);

  const [user, requests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.profileChangeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { decidedBy: { select: { id: true, firstName: true, lastName: true } } },
    }),
  ]);

  if (!user) {
    throw ApiError.notFound("Account not found.");
  }

  new ApiResponse(200, "OK", { requests: requests.map((request) => withDiff(request, user)) }).send(res);
});

const notifyDecided = async (request, accepted, remarks) => {
  const label = PROFILE_CHANGE_SECTIONS[request.section]?.label ?? request.section;
  const detail = accepted
    ? `Your ${label} change has been approved and applied.`
    : `Your ${label} change was rejected${remarks ? `: ${remarks}` : "."}`;

  try {
    await notificationService.notify({
      userId: request.userId,
      type: notificationService.NOTIFICATION_TYPES.PROFILE_CHANGE_DECIDED,
      title: accepted ? "Profile change approved" : "Profile change rejected",
      message: detail,
      link: "/profile",
    });

    const otherAdmins = await prisma.user.findMany({
      where: { userType: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });
    await notificationService.notifyMany(
      otherAdmins.map((admin) => admin.id),
      {
        type: notificationService.NOTIFICATION_TYPES.PROFILE_CHANGE_DECIDED,
        title: accepted ? "Profile change approved" : "Profile change rejected",
        message: `${request.user.firstName} ${request.user.lastName}'s ${label} change was ${
          accepted ? "approved" : "rejected"
        }.`,
        link: `/admin/users/${request.userId}/details`,
      }
    );
  } catch (err) {
    console.error("Failed to create profile change decision notification:", err);
  }
};

const loadPendingRequest = async (id) => {
  const request = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!request) {
    throw ApiError.notFound("Change request not found.");
  }
  if (request.status !== "PENDING") {
    throw ApiError.badRequest("This request has already been decided.");
  }
  return request;
};

const accept = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const request = await loadPendingRequest(id);

  const config = PROFILE_CHANGE_SECTIONS[request.section];
  const data = {};
  const supersededFiles = [];
  for (const [field, value] of Object.entries(request.changes || {})) {
    if (!config.fields.includes(field)) continue; // ignore anything unexpected
    data[field] = PROFILE_CHANGE_DATE_FIELDS.has(field) && value ? new Date(value) : value;
    // The document this new file replaces - delete it from S3 once applied.
    if (PROFILE_CHANGE_DOCUMENT_FIELDS.has(field) && request.user[field] && request.user[field] !== value) {
      supersededFiles.push(request.user[field]);
    }
  }

  const [, updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: request.userId }, data }),
    prisma.profileChangeRequest.update({
      where: { id },
      data: { status: "ACCEPTED", decidedById: req.user.id, decidedAt: new Date() },
    }),
  ]);

  new ApiResponse(200, "Change request approved and applied.", { request: updated }).send(res);

  for (const oldUrl of supersededFiles) {
    deleteFromS3(oldUrl).catch((err) => console.error("Failed to delete superseded profile document:", err));
  }
  await notifyDecided(request, true);
});

const reject = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const remarks = (req.body.remarks || "").trim() || null;
  const request = await loadPendingRequest(id);

  const updated = await prisma.profileChangeRequest.update({
    where: { id },
    data: { status: "REJECTED", adminRemarks: remarks, decidedById: req.user.id, decidedAt: new Date() },
  });

  new ApiResponse(200, "Change request rejected.", { request: updated }).send(res);

  // The uploaded-but-not-approved files are now dead weight - remove them.
  for (const [field, value] of Object.entries(request.changes || {})) {
    if (PROFILE_CHANGE_DOCUMENT_FIELDS.has(field) && value) {
      deleteFromS3(value).catch((err) => console.error("Failed to delete rejected profile document:", err));
    }
  }
  await notifyDecided(request, false, remarks);
});

module.exports = { listForUser, accept, reject };
