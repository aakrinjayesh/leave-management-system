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
  // The Excel sheet is only mandatory for CLIENT projects - that "is it
  // required?" check lives in the submitWeek controller, where the project's
  // type is known. Here the fields are just optional-but-non-empty-if-present.
  attachmentOriginalName: z.string().min(1).optional(),
  attachmentStoredName: z.string().min(1).optional(),
  // projectAssigned isn't taken from the client - it's derived from the
  // chosen project's own admin-set type (see submitWeek controller).
  projectId: z.coerce.number().int().positive({ message: "Please choose which project this timesheet is for." }),
});

// Manager/admin logging a whole period's day-by-day hours on an employee's
// behalf, then submitting it auto-approved. `days` carries every date in the
// grid (0-hour days included so drafts can be cleared).
const logTimesheetSchema = z.object({
  projectId: z.coerce.number().int().positive({ message: "Please choose which project this timesheet is for." }),
  weekStartDate: z.coerce.date({ message: "Please choose a valid period." }),
  days: z
    .array(
      z.object({
        date: z.coerce.date({ message: "Please choose a valid date." }),
        hoursWorked: z.coerce.number().min(0).max(24, "Hours can't exceed 24 in a day."),
        description: z.string().trim().max(500).optional(),
      })
    )
    .min(1, "Please enter hours for at least one day."),
  // Only mandatory for CLIENT projects - enforced in timesheetLog.service.js
  // where the project type is known.
  attachmentOriginalName: z.string().min(1).optional(),
  attachmentStoredName: z.string().min(1).optional(),
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
  logTimesheetSchema,
  approveTimesheetSchema,
  rejectTimesheetSchema,
};
