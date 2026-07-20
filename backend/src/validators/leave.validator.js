const { z } = require("zod");

const applyLeaveSchema = z
  .object({
    leavePolicyId: z.coerce.number().int().positive("Please choose a leave type."),
    startDate: z.coerce.date({ message: "Please choose a valid start date." }),
    endDate: z.coerce.date({ message: "Please choose a valid end date." }),
    isHalfDay: z.coerce.boolean().optional().default(false),
    reason: z.string().trim().min(5, "Please provide a short reason (at least 5 characters).").max(500),
    attachmentUrl: z.string().trim().min(1).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

const createLeaveForEmployeeSchema = z
  .object({
    leavePolicyId: z.coerce.number().int().positive("Please choose a leave type."),
    startDate: z.coerce.date({ message: "Please choose a valid start date." }),
    endDate: z.coerce.date({ message: "Please choose a valid end date." }),
    isHalfDay: z.coerce.boolean().optional().default(false),
    reason: z.string().trim().min(5, "Please provide a short reason (at least 5 characters).").max(500),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  });

const approveLeaveSchema = z.object({
  remarks: z.string().trim().max(500).optional(),
});

const rejectLeaveSchema = z.object({
  remarks: z.string().trim().min(3, "Please explain why this request is being rejected.").max(500),
});

module.exports = { applyLeaveSchema, createLeaveForEmployeeSchema, approveLeaveSchema, rejectLeaveSchema };
