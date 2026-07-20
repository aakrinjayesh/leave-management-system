const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const companySettingsService = require("../services/companySettings.service");

const getConfig = asyncHandler(async (req, res) => {
  const settings = await companySettingsService.getSettings();

  new ApiResponse(200, "OK", {
    companyName: settings.companyName,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
    allowPastLeave: settings.allowPastLeave,
    allowFutureLeave: settings.allowFutureLeave,
    maxFutureDays: settings.maxFutureDays,
  }).send(res);
});

module.exports = { getConfig };
