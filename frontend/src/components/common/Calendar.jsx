import { ChevronLeft, ChevronRight } from "lucide-react";
import "./Calendar.css";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const toDateKey = (input) => new Date(input).toISOString().slice(0, 10);

// A leave's stored startDate/endDate is the raw calendar range the employee
// picked - weekends and holidays inside that range were never counted as
// leave days (see computeWorkingDays on the backend), so they shouldn't be
// painted as leave here either.
const buildLeaveByDate = (leaveEntries, year, month, weekendSet, holidayByDate) => {
  const map = new Map();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  for (const entry of leaveEntries) {
    const start = new Date(entry.startDate) < monthStart ? monthStart : new Date(entry.startDate);
    const end = new Date(entry.endDate) > monthEnd ? monthEnd : new Date(entry.endDate);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (cursor <= last) {
      const key = toDateKey(cursor);
      if (!weekendSet.has(key) && !holidayByDate.has(key)) {
        const existing = map.get(key) || [];
        existing.push(entry);
        map.set(key, existing);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return map;
};

export default function Calendar({ year, month, weekendDates = [], holidays = [], leaveEntries = [], onPrevMonth, onNextMonth }) {
  const weekendSet = new Set(weekendDates);
  const holidayByDate = new Map(holidays.map((h) => [h.date, h]));
  const leaveByDate = buildLeaveByDate(leaveEntries, year, month, weekendSet, holidayByDate);

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlankCount = firstOfMonth.getUTCDay();
  const todayKey = toDateKey(new Date());

  const cells = [];
  for (let i = 0; i < leadingBlankCount; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(Date.UTC(year, month - 1, day)));
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <span className="calendar-title">
          {MONTH_LABELS[month - 1]} {year}
        </span>
        <div className="calendar-nav">
          <button type="button" className="calendar-nav-btn" onClick={onPrevMonth} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="calendar-nav-btn" onClick={onNextMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-weekday-row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((date, index) => {
          if (!date) return <div key={`blank-${index}`} className="calendar-cell is-outside" />;

          const key = toDateKey(date);
          const isWeekend = weekendSet.has(key);
          const holiday = holidayByDate.get(key);
          const leaves = leaveByDate.get(key) || [];

          return (
            <div
              key={key}
              className={`calendar-cell ${isWeekend ? "is-weekend" : ""} ${key === todayKey ? "is-today" : ""}`.trim()}
            >
              <span className="calendar-cell-date">{date.getUTCDate()}</span>
              {holiday && <span className="calendar-holiday-tag">{holiday.name}</span>}
              {leaves.slice(0, 2).map((leave, i) => (
                <span key={i} className={`calendar-leave-tag status-${leave.status.toLowerCase()}`}>
                  {leave.label}
                </span>
              ))}
              {leaves.length > 2 && <span className="calendar-holiday-tag">+{leaves.length - 2} more</span>}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot" style={{ backgroundColor: "var(--color-success-text)" }} />
          Approved leave
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot" style={{ backgroundColor: "var(--color-warning-text)" }} />
          Pending leave
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot" style={{ backgroundColor: "var(--color-primary-600)" }} />
          Holiday
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-dot" style={{ backgroundColor: "var(--color-gray-400)" }} />
          Weekend
        </span>
      </div>
    </div>
  );
}
