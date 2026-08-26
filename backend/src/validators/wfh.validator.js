const { z } = require("zod");

const submitWfhRequestSchema = z
  .object({
    startDate: z.coerce.date({ message: "Please choose a start date." }),
    endDate: z.coerce.date({ message: "Please choose an end date." }),
    reason: z.string().trim().min(5, "Please provide a short reason (at least 5 characters).").max(1000),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

const rejectWfhRequestSchema = z.object({
  remarks: z.string().trim().min(3, "Please explain why this WFH request is being rejected.").max(500),
});

module.exports = { submitWfhRequestSchema, rejectWfhRequestSchema };
