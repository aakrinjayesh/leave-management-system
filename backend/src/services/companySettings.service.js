const prisma = require("../config/prisma");
const { getFiscalYear } = require("../utils/fiscalYear.util");

const DEFAULTS = {
  companyName: "Aakrin",
  fiscalYearStartMonth: 4,
  timezone: "Asia/Kolkata",
  allowPastLeave: false,
  allowFutureLeave: true,
  maxFutureDays: 90,
  supportContactName: "Krishna Dadi",
  supportContactEmail: "krishna.dadi@aakrin.com",
  supportContactPhone: "+91 90000 00000",
};

const getSettings = async () => {
  const settings = await prisma.companySettings.findFirst();
  return settings || DEFAULTS;
};

const updateSettings = async (data) => {
  const existing = await prisma.companySettings.findFirst();
  if (existing) {
    return prisma.companySettings.update({ where: { id: existing.id }, data });
  }
  return prisma.companySettings.create({ data: { ...DEFAULTS, ...data } });
};

// The fiscal year `date` falls in, per the company's configured start month
// - used everywhere a leave balance or payroll figure needs to know which
// yearly bucket it belongs to, instead of a manually-tracked year number.
const getFiscalYearForDate = async (date) => {
  const settings = await getSettings();
  return getFiscalYear(date, settings.fiscalYearStartMonth);
};

const getCurrentFiscalYear = () => getFiscalYearForDate(new Date());

module.exports = { getSettings, updateSettings, getFiscalYearForDate, getCurrentFiscalYear };
