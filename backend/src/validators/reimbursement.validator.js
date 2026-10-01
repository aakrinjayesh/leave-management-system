const { z } = require("zod");

// Fields arrive as multipart/form-data strings (the request also carries the
// uploaded files), so everything is coerced.
const claimFieldsSchema = z.object({
  subject: z.string().trim().min(3, "Please enter a subject (at least 3 characters).").max(150),
  description: z
    .string()
    .trim()
    .min(5, "Please describe the expense (at least 5 characters).")
    .max(2000),
  amount: z.coerce
    .number({ message: "Please enter a valid amount." })
    .positive("Amount must be greater than 0.")
    .max(10000000, "That amount looks too large - please check it."),
});

const createReimbursementSchema = claimFieldsSchema;
const logReimbursementForEmployeeSchema = claimFieldsSchema;

const approveReimbursementSchema = z.object({
  remarks: z.string().trim().max(500).optional(),
});

const rejectReimbursementSchema = z.object({
  remarks: z.string().trim().min(3, "Please give a reason for rejecting this claim.").max(500),
});

module.exports = {
  createReimbursementSchema,
  logReimbursementForEmployeeSchema,
  approveReimbursementSchema,
  rejectReimbursementSchema,
};
