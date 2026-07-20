const { z } = require("zod");

const updateManagerSchema = z.object({
  managerId: z.coerce.number().int().positive("Please choose your manager."),
});

module.exports = { updateManagerSchema };
