const ApiError = require("../utils/ApiError");

// Validates req.body against a Zod schema, replacing it with the parsed
// (and type-coerced) result so controllers get clean, trusted data.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return next(ApiError.badRequest(details[0]?.message || "Invalid input.", details));
  }

  req.body = result.data;
  next();
};

module.exports = validate;
