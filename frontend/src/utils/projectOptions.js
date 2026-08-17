// Shared between the admin "Manage projects" screen (sets these) and the
// employee timesheet (just displays them) - single source of truth so the
// two stay in sync with the backend's ProjectAssignmentStatus enum values.
export const PROJECT_TYPE_OPTIONS = [
  { value: "ASSIGNED", label: "Client Project" },
  { value: "NOT_ASSIGNED", label: "Internal Project" },
];

// Timezone itself is free text on the backend (not an enum) - admin can pick
// one of these as a suggestion or type any other label. The `value` codes
// only exist so older rows saved before free text was allowed (e.g. a plain
// "IST") still resolve to a friendly label - see findLabel's fallback below.
export const TIMEZONE_OPTIONS = [
  { value: "IST", label: "India (IST, UTC+5:30)" },
  { value: "US_EASTERN", label: "USA Eastern (ET, UTC-5/-4)" },
  { value: "US_PACIFIC", label: "USA Pacific (PT, UTC-8/-7)" },
  { value: "DUBAI", label: "Dubai (GST, UTC+4)" },
  { value: "UK", label: "UK (GMT/BST, UTC+0/+1)" },
  { value: "SINGAPORE", label: "Singapore (SGT, UTC+8)" },
];

const findLabel = (options, value) => options.find((o) => o.value === value)?.label || value;

export const formatProjectType = (value) => findLabel(PROJECT_TYPE_OPTIONS, value);

export const formatProjectTimezone = (value) => findLabel(TIMEZONE_OPTIONS, value);

// Pre-fills an edit form with a friendly label rather than a bare legacy
// code ("IST" -> "India (IST, UTC+5:30)") - anything already free text
// passes through unchanged.
export const toEditableTimezoneValue = (value) => findLabel(TIMEZONE_OPTIONS, value);

// "9:00 AM" from a 24-hour "HH:mm" string.
const formatTimeOfDay = (value) => {
  if (!value) return "";
  const [hourStr, minute] = value.split(":");
  const hour = Number(hourStr);
  const period = hour >= 12 ? "PM" : "AM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${minute} ${period}`;
};

// "9:00 AM - 6:00 PM IST" - matches a known suggestion (by code or by its
// full label, in case that's exactly what was typed) for a short zone name,
// otherwise falls back to showing whatever custom text was entered as-is.
export const formatWorkingHours = (project) => {
  if (!project) return "";
  const match = TIMEZONE_OPTIONS.find((o) => o.value === project.timezone || o.label === project.timezone);
  const zoneLabel = match ? match.label.split(" (")[0] : project.timezone;
  return `${formatTimeOfDay(project.workStartTime)} - ${formatTimeOfDay(project.workEndTime)} ${zoneLabel}`;
};
