const { z } = require("zod");

const updateManagerSchema = z.object({
  managerId: z.coerce.number().int().positive("Please choose your manager."),
});

// proposedLastWorkingDate is just the employee's own notice date, not yet
// official - the real, confirmed lastWorkingDate only gets set once admin
// accepts (proposedLastWorkingDate + noticePeriodDays). No minimum notice
// enforced on the proposed date itself, only that it isn't in the past.
const submitResignationSchema = z
  .object({
    reason: z.string().trim().min(5, "Please provide a short reason (at least 5 characters).").max(2000),
    proposedLastWorkingDate: z.coerce.date({ message: "Please choose your last working day." }),
  })
  .refine(
    (data) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return data.proposedLastWorkingDate >= today;
    },
    {
      message: "Your last working day can't be in the past.",
      path: ["proposedLastWorkingDate"],
    }
  );

module.exports = { updateManagerSchema, submitResignationSchema };
