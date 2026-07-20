const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const timesheetService = require("../services/timesheet.service");
const { sendTimesheetSubmittedEmail } = require("../utils/email.util");

const getMyEntries = asyncHandler(async (req, res) => {
  const anchor = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
  const weekStartDate = timesheetService.getWeekStart(anchor);
  const weekEndDate = timesheetService.getWeekEnd(weekStartDate);

  const [entries, submission] = await Promise.all([
    prisma.timesheetEntry.findMany({
      where: { userId: req.user.id, date: { gte: weekStartDate, lte: weekEndDate } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    prisma.timesheetSubmission.findUnique({
      where: { userId_weekStartDate: { userId: req.user.id, weekStartDate } },
    }),
  ]);

  new ApiResponse(200, "OK", {
    weekStartDate,
    weekEndDate,
    entries,
    submission,
    totalHours: timesheetService.sumHours(entries),
  }).send(res);
});

// One entry per user per date - saving a day creates it if it doesn't exist
// yet, or updates it in place if it does (the grid always edits in place,
// never creates a second entry for the same day).
const saveEntry = asyncHandler(async (req, res) => {
  const { date, hoursWorked, description } = req.body;
  const entryDate = timesheetService.startOfUtcDay(date);
  const weekStartDate = timesheetService.getWeekStart(entryDate);

  // A rejected submission no longer blocks editing - its entries were
  // already unlocked when it was rejected, and the week stays open until a
  // fresh submission is created.
  const existingSubmission = await prisma.timesheetSubmission.findUnique({
    where: { userId_weekStartDate: { userId: req.user.id, weekStartDate } },
  });
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    throw ApiError.badRequest("This week has already been submitted and can no longer be edited.");
  }

  const entry = await prisma.timesheetEntry.upsert({
    where: { userId_date: { userId: req.user.id, date: entryDate } },
    update: { hoursWorked, description: description || null },
    create: {
      userId: req.user.id,
      date: entryDate,
      hoursWorked,
      description: description || null,
      weekStartDate,
    },
  });

  new ApiResponse(200, "Entry saved.", { entry }).send(res);
});

const getOwnUnlockedEntryOr404 = async (id, userId) => {
  const entry = await prisma.timesheetEntry.findFirst({ where: { id, userId } });
  if (!entry) {
    throw ApiError.notFound("Timesheet entry not found.");
  }
  if (entry.timesheetSubmissionId) {
    throw ApiError.badRequest("This entry is part of a submitted week and can no longer be changed.");
  }
  return entry;
};

const deleteEntry = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  await getOwnUnlockedEntryOr404(id, req.user.id);

  await prisma.timesheetEntry.delete({ where: { id } });

  new ApiResponse(200, "Entry deleted.").send(res);
});

const submitWeek = asyncHandler(async (req, res) => {
  const { weekStartDate: rawWeekStart } = req.body;
  const weekStartDate = timesheetService.getWeekStart(rawWeekStart);
  const weekEndDate = timesheetService.getWeekEnd(weekStartDate);

  if (!req.user.managerId) {
    throw ApiError.badRequest("Please set your manager in your profile before submitting a timesheet.");
  }

  const recipient = await prisma.user.findFirst({ where: { id: req.user.managerId, status: "ACTIVE" } });
  if (!recipient) {
    throw ApiError.badRequest("Your assigned manager's account isn't active. Please update your manager in your profile.");
  }

  const existingSubmission = await prisma.timesheetSubmission.findUnique({
    where: { userId_weekStartDate: { userId: req.user.id, weekStartDate } },
  });
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    throw ApiError.badRequest("This week has already been submitted.");
  }

  const draftEntries = await prisma.timesheetEntry.findMany({
    where: { userId: req.user.id, weekStartDate, timesheetSubmissionId: null },
  });
  if (draftEntries.length === 0) {
    throw ApiError.badRequest("There are no entries to submit for this week.");
  }

  const totalHours = timesheetService.sumHours(draftEntries);

  // A week can only ever have one submission row (userId + weekStartDate is
  // unique), so resubmitting after a rejection reopens that same row as a
  // fresh Pending submission instead of creating a new one.
  const submission = existingSubmission
    ? await prisma.timesheetSubmission.update({
        where: { id: existingSubmission.id },
        data: {
          totalHours,
          routedToId: recipient.id,
          status: "PENDING",
          managerRemarks: null,
          approvedById: null,
          approvedAt: null,
          rejectedAt: null,
          submittedAt: new Date(),
        },
      })
    : await prisma.timesheetSubmission.create({
        data: {
          userId: req.user.id,
          weekStartDate,
          weekEndDate,
          totalHours,
          routedToId: recipient.id,
          status: "PENDING",
        },
      });

  await prisma.timesheetEntry.updateMany({
    where: { id: { in: draftEntries.map((e) => e.id) } },
    data: { timesheetSubmissionId: submission.id },
  });

  // Notify the manager and every active admin - failures here shouldn't fail
  // the submission itself.
  try {
    const admins = await prisma.user.findMany({ where: { userType: "ADMIN", status: "ACTIVE" } });
    const recipients = [recipient, ...admins.filter((a) => a.id !== recipient.id)];

    for (const person of recipients) {
      await sendTimesheetSubmittedEmail({
        to: person.email,
        recipientFirstName: person.firstName,
        employeeName: `${req.user.firstName} ${req.user.lastName}`,
        weekStartDate,
        weekEndDate,
        totalHours,
      });
    }
  } catch (err) {
    console.error("Failed to send timesheet submitted email:", err);
  }

  new ApiResponse(201, "Timesheet submitted.", { submission }).send(res);
});

const listMySubmissions = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const submissions = await prisma.timesheetSubmission.findMany({
    where: { userId: req.user.id, ...(status ? { status } : {}) },
    include: {
      routedTo: { select: { firstName: true, lastName: true } },
      entries: { orderBy: { date: "asc" } },
    },
    orderBy: { weekStartDate: "desc" },
  });

  new ApiResponse(200, "OK", { submissions }).send(res);
});

module.exports = {
  getMyEntries,
  saveEntry,
  deleteEntry,
  submitWeek,
  listMySubmissions,
};
