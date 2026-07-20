const DATE_FORMATTER = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const formatDate = (input) => DATE_FORMATTER.format(new Date(input));

export const formatDateRange = (start, end) => {
  const startKey = new Date(start).toISOString().slice(0, 10);
  const endKey = new Date(end).toISOString().slice(0, 10);
  if (startKey === endKey) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
};
