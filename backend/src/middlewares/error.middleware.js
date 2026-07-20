const ApiError = require("../utils/ApiError");

const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  if (err.isApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
};

module.exports = { notFound, errorHandler };
