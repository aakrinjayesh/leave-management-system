// Shared short-date formatter for notification messages, e.g. "12 Aug 2026" -
// same style already used inside email.util.js's own (unexported) copy.
const formatDateShort = (date) => new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

module.exports = { formatDateShort };
