// Given a date and the month the fiscal year starts in (1-12), returns the
// fiscal year's label - the calendar year that start month falls in. E.g.
// with an April (4) start, February 2027 belongs to fiscal year 2026
// (April 2026 - March 2027), same as December 2026 does.
const getFiscalYear = (date, fiscalYearStartMonth) => {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  return month >= fiscalYearStartMonth ? year : year - 1;
};

module.exports = { getFiscalYear };
