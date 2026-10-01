// Calendar-aware years/months/days completed since a joining date.
export const getTenureParts = (joiningDateValue) => {
  const start = new Date(joiningDateValue);
  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
};

// e.g. "1 year, 4 months, 20 days" - matches how tenure is normally described.
export const formatTenure = (joiningDateValue) => {
  const { years, months, days } = getTenureParts(joiningDateValue);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);

  return parts.join(", ");
};

// Compact one-line form for tight spaces, e.g. "1 yr · 4 mo · 20 days".
export const formatTenureShort = (joiningDateValue) => {
  const { years, months, days } = getTenureParts(joiningDateValue);

  const parts = [];
  if (years > 0) parts.push(`${years} yr`);
  if (months > 0) parts.push(`${months} mo`);
  if (days > 0 || parts.length === 0) parts.push(`${days} ${days === 1 ? "day" : "days"}`);

  return parts.join(" · ");
};
