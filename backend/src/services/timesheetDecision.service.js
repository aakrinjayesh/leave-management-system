const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");
const notificationService = require("./notification.service");
const { sendTimesheetDecisionEmail } = require("../utils/email.util");
const { formatDateShort } = require("../utils/formatDate.util");

// Shared approve/reject logic for a pending weekly timesheet submission, used
// by both the manager view (only submissions routed to them) and the admin
// "All timesheets" view (any submission). The caller loads the submission
// (with its `user`) and checks that this actor is allowed to act on it - this
// service only enforces the submission-state rule and applies the decision.

const applyDecision = async ({ submission, actor, decision, remarks }) => {
  if (submission.status !== "PENDING") {
    throw ApiError.badRequest("This timesheet has already been actioned.");
  }

  if (decision === "APPROVED") {
    return prisma.timesheetSubmission.update({
      where: { id: submission.id },
      data: {
        status: "APPROVED",
        approvedById: actor.id,
        approvedAt: new Date(),
        managerRemarks: remarks || null,
      },
    });
  }

  // Rejecting doesn't touch the entries' hours/description - it just lifts the
  // lock (detaches them from the submission) so the employee can fix them and
  // submit the week again. The rejected submission row stays as-is for history.
  const [updated] = await prisma.$transaction([
    prisma.timesheetSubmission.update({
      where: { id: submission.id },
      data: {
        status: "REJECTED",
        approvedById: actor.id,
        rejectedAt: new Date(),
        managerRemarks: remarks,
      },
    }),
    prisma.timesheetEntry.updateMany({
      where: { timesheetSubmissionId: submission.id },
      data: { timesheetSubmissionId: null },
    }),
  ]);

  return updated;
};

// Fire-and-forget email + in-app notification for the employee. Call after the
// HTTP response is sent; failures are logged, not surfaced.
const sendDecisionSideEffects = async ({ submission, actor, decision, remarks }) => {
  const actorName = `${actor.firstName} ${actor.lastName}`;
  const verb = decision === "APPROVED" ? "approved" : "rejected";

  try {
    await sendTimesheetDecisionEmail({
      to: submission.user.email,
      employeeFirstName: submission.user.firstName,
      weekStartDate: submission.weekStartDate,
      weekEndDate: submission.weekEndDate,
      totalHours: submission.totalHours,
      status: decision,
      managerName: actorName,
      remarks: remarks || null,
    });
  } catch (err) {
    console.error(`Failed to send timesheet ${verb} email:`, err);
  }

  try {
    await notificationService.notify({
      userId: submission.user.id,
      type: notificationService.NOTIFICATION_TYPES.TIMESHEET_DECIDED,
      title: `Timesheet ${verb}`,
      message: `Your timesheet for the week of ${formatDateShort(submission.weekStartDate)} - ${formatDateShort(
        submission.weekEndDate
      )} was ${verb} by ${actorName}.`,
    });
  } catch (err) {
    console.error(`Failed to create timesheet ${verb} notification:`, err);
  }
};

module.exports = { applyDecision, sendDecisionSideEffects };
