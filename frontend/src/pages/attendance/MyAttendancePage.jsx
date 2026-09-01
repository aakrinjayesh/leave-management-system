import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Modal from "../../components/common/Modal";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as attendanceApi from "../../api/attendance.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { statusMeta } from "../../utils/attendanceStatus";
import "../../styles/dashboardShared.css";

const MONTH_LABEL = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric" });

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEGEND = ["PRESENT", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT", "HOLIDAY"];

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// Modal shown when the employee clicks a markable day - one row per project,
// each with Present / Half day / Absent.
function MarkModal({ day, onClose, onSaved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // `${projectId}|${action}`

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const set = async (projectId, status) => {
    setError("");
    setBusy(`${projectId}|${status}`);
    try {
      await attendanceApi.markAttendance({ projectId, date: day.date, status });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your attendance."));
      setBusy(null);
    }
  };

  return (
    <Modal title={`Mark attendance — ${dateLabel}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <div className="att-modal-projects">
        {day.perProject.map((p) => {
          const isPresent = p.status === "PRESENT";
          const isHalf = p.status === "HALF_DAY";
          const marked = isPresent || isHalf;
          return (
            <div className="att-modal-project" key={p.projectId}>
              <span className="att-modal-project-name">{p.projectName}</span>
              <div className="att-toggle">
                <button
                  type="button"
                  className={`att-toggle-btn ${isPresent ? "is-on is-present" : ""}`}
                  disabled={busy === `${p.projectId}|PRESENT`}
                  onClick={() => set(p.projectId, "PRESENT")}
                >
                  Present
                </button>
                <button
                  type="button"
                  className={`att-toggle-btn ${isHalf ? "is-on is-half" : ""}`}
                  disabled={busy === `${p.projectId}|HALF_DAY`}
                  onClick={() => set(p.projectId, "HALF_DAY")}
                >
                  Half day
                </button>
                <button
                  type="button"
                  className={`att-toggle-btn ${!marked ? "is-on is-absent" : ""}`}
                  disabled={busy === `${p.projectId}|ABSENT`}
                  onClick={() => set(p.projectId, "ABSENT")}
                >
                  Absent
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary page-header-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export default function MyAttendancePage() {
  const { year, month, goToPrevMonth, goToNextMonth } = useMonthNavigation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [markDay, setMarkDay] = useState(null);

  useEffect(() => {
    attendanceApi
      .getMyAttendance(year, month)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  }, [year, month]);

  const reload = () =>
    attendanceApi
      .getMyAttendance(year, month)
      .then((d) => {
        setData(d);
        // keep the modal in sync with the freshly-saved statuses
        setMarkDay((prev) => (prev ? d.month.days.find((x) => x.date === prev.date) || null : null));
      })
      .catch((err) => setError(getErrorMessage(err)));

  const monthReady = data && data.month.year === year && data.month.month === month;

  const renderMonth = () => {
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    data.month.days.forEach((day) => cells.push(day));

    return (
      <div className="card">
        <div className="card-section">
          <div className="section-flex-row">
            <button type="button" className="link-btn" onClick={goToPrevMonth}>
              <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Prev
            </button>
            <span className="card-section-title" style={{ marginBottom: 0 }}>
              {MONTH_LABEL(year, month)}
            </span>
            <button type="button" className="link-btn" onClick={goToNextMonth}>
              Next <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
            </button>
          </div>

          <p className="card-section-subtitle" style={{ marginTop: 10, marginBottom: 10 }}>
            Click a highlighted day to mark it. You can fill in the last {data.backfillDays} days.
          </p>

          <div className="att-grid-wrap" style={{ marginTop: 4 }}>
            <table className="att-grid att-cal">
              <thead>
                <tr>
                  {WEEKDAYS.map((w) => (
                    <th key={w}>{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.ceil(cells.length / 7) }).map((_, row) => (
                  <tr key={row}>
                    {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
                      if (!day) return <td key={i} />;
                      const meta = statusMeta(day.overall || "FUTURE");
                      const isToday = day.date === data.todayKey;
                      const dnum = Number(day.date.slice(8, 10));
                      return (
                        <td key={i} style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className={`att-cal-cell att-cell ${meta.cls} ${day.markable ? "is-clickable" : ""}`}
                            disabled={!day.markable}
                            title={`${dnum} — ${meta.label || "—"}${day.markable ? " (click to mark)" : ""}`}
                            onClick={day.markable ? () => setMarkDay(day) : undefined}
                          >
                            <span className={`att-grid-daynum ${isToday ? "is-today" : ""}`}>{dnum}</span>
                            {meta.short && <span className="att-cal-mark">{meta.short}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="att-legend">
            {LEGEND.map((s) => {
              const meta = statusMeta(s);
              return (
                <span className="att-legend-item" key={s}>
                  <span className={`att-legend-swatch ${meta.cls}`} />
                  {meta.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title="Attendance">
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p>Click a day in the calendar to mark yourself present, half day, or absent.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      {!monthReady ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <>
          {data.summary && (
            <div className="att-summary">
              <div className="att-summary-tile">
                <div className="att-summary-value">
                  {fmt(data.summary.worked)}
                  <span className="att-summary-of"> / {data.summary.workingDays}</span>
                </div>
                <div className="att-summary-label">Worked this month</div>
              </div>
              <div className="att-summary-tile">
                <div className="att-summary-value">{data.summary.present}</div>
                <div className="att-summary-label">Present</div>
              </div>
              <div className="att-summary-tile">
                <div className="att-summary-value">{data.summary.halfDay}</div>
                <div className="att-summary-label">Half day</div>
              </div>
              <div className="att-summary-tile">
                <div className="att-summary-value">{data.summary.absent}</div>
                <div className="att-summary-label">Absent</div>
              </div>
              <div className="att-summary-tile">
                <div className="att-summary-value">{data.summary.leave}</div>
                <div className="att-summary-label">On leave</div>
              </div>
            </div>
          )}

          {data.projects.length === 0 ? (
            <div className="card">
              <div className="card-section">
                <div className="empty-state">
                  <p>You're not on any project yet. Attendance starts once a project is assigned to you.</p>
                </div>
              </div>
            </div>
          ) : (
            renderMonth()
          )}
        </>
      )}

      {markDay && <MarkModal day={markDay} onClose={() => setMarkDay(null)} onSaved={reload} />}
    </DashboardLayout>
  );
}
