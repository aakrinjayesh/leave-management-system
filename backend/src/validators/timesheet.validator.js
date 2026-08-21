const { z } = require("zod");

// Saving a day is now create-or-update (one entry per user per date per
// project) - the same schema covers both cases.
const saveEntrySchema = z.object({
  date: z.coerce.date({ message: "Please choose a valid date." }),
  hoursWorked: z.coerce.number().positive("Hours must be greater than 0.").max(24, "Hours can't exceed 24 in a day."),
  description: z.string().trim().max(500).optional(),
  projectId: z.coerce.number().int().positive({ message: "Please choose which project this entry is for." }),
});

const submitWeekSchema = z.object({
  weekStartDate: z.coerce.date({ message: "Please choose a valid week." }),
  attachmentOriginalName: z.string().min(1, "Please upload this week's Excel sheet before submitting."),
  attachmentStoredName: z.string().min(1, "Please upload this week's Excel sheet before submitting."),
  // projectAssigned isn't taken from the client - it's derived from the
  // chosen project's own admin-set type (see submitWeek controller).
  projectId: z.coerce.number().int().positive({ message: "Please choose which project this timesheet is for." }),
});

const approveTimesheetSchema = z.object({
  remarks: z.string().trim().max(500).optional(),
});

const rejectTimesheetSchema = z.object({
  remarks: z.string().trim().min(3, "Please explain why this timesheet is being rejected.").max(500),
});

module.exports = {
  saveEntrySchema,
  submitWeekSchema,
  approveTimesheetSchema,
  rejectTimesheetSchema,
};
