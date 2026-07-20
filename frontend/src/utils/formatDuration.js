// hoursWorked is stored as a single decimal (e.g. 1.5 = 1h 30m). These
// helpers convert between that decimal and separate hours/minutes fields
// for editing and display.

export const splitHoursMinutes = (decimalHours) => {
  const totalMinutes = Math.round((Number(decimalHours) || 0) * 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
};

export const combineHoursMinutes = (hours, minutes) => {
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  return Math.round((h + m / 60) * 100) / 100;
};

export const formatHoursMinutes = (decimalHours) => {
  const { hours, minutes } = splitHoursMinutes(decimalHours);
  if (hours === 0 && minutes === 0) return "0h";
  return [hours > 0 ? `${hours}h` : "", minutes > 0 ? `${minutes}m` : ""].filter(Boolean).join(" ");
};
