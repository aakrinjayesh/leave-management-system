import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import Spinner from "./Spinner";
import * as commonApi from "../../api/common.api";
import "../../styles/dashboardShared.css";

const DAYS_AHEAD = 30;
const SHORT_DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

const daysAway = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr) - today) / 86400000);
};

export default function UpcomingHolidaysCard() {
  const [holidays, setHolidays] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    commonApi
      .getUpcomingHolidays(DAYS_AHEAD)
      .then((data) => setHolidays(data.holidays))
      .catch(() => setError("Couldn't load holidays."));
  }, []);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <div className="section-flex-row" style={{ marginBottom: 4 }}>
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            Upcoming holidays
          </span>
          <CalendarDays size={16} style={{ color: "var(--text-secondary)" }} />
        </div>
        <p className="card-section-subtitle">Company holidays in the next {DAYS_AHEAD} days.</p>

        {error ? (
          <p className="intro-item-empty">{error}</p>
        ) : !holidays ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
            <Spinner size={20} />
          </div>
        ) : holidays.length === 0 ? (
          <p className="intro-item-empty">No holidays in the next {DAYS_AHEAD} days.</p>
        ) : (
          <div className="holiday-chips">
            {holidays.map((h, i) => {
              const d = daysAway(h.holidayDate);
              return (
                <span key={h.id} className={`holiday-chip holiday-chip--${i % 5}`}>
                  <span className="holiday-chip-name">
                    {h.holidayName}
                    {h.isOptional ? " (optional)" : ""}
                  </span>
                  <span className="holiday-chip-date">
                    {SHORT_DATE.format(new Date(h.holidayDate))}
                    {" · "}
                    {d === 0 ? "today" : d === 1 ? "tomorrow" : `${d}d`}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
