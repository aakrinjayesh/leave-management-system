const HOURS_PER_DAY = 8;

const trimDecimal = (n) => (Number.isInteger(n) ? n : parseFloat(n.toFixed(2)));

// Formats a leave-days number showing both units - e.g. "2.5 days (20h)" -
// since balances now accrue in fractional days (half days, carried-forward
// remainders) that read more precisely in hours.
export const formatLeaveDays = (days) => {
  const value = Number(days) || 0;
  const dayLabel = `${trimDecimal(value)} day${value === 1 ? "" : "s"}`;
  const hours = trimDecimal(value * HOURS_PER_DAY);
  return `${dayLabel} (${hours}h)`;
};
