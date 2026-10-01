import FormSelect from "./FormSelect";

// Every 30 minutes across the day, as { value: 24-hour "HH:mm", label: 12-hour
// "h:mm AM/PM" } - value is what's actually stored/sent (matches the
// backend's project-hours validator and what native <input type="time"> uses
// internally); label is what the user sees, so working hours read naturally
// ("9:00 AM") without the 24-hour clock native time inputs default to on
// most browsers/locales. Only :00 and :30 - projects use round half-hours.
const TIME_OPTIONS = Array.from({ length: 24 * 2 }, (_, i) => {
  const totalMinutes = i * 30;
  const h24 = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return {
    value: `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    label: `${h12}:${String(m).padStart(2, "0")} ${period}`,
  };
});

export default function TimeOfDayField({ label, value, onChange }) {
  return (
    <FormSelect label={label} value={value || ""} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled hidden>
        Select…
      </option>
      {TIME_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormSelect>
  );
}
