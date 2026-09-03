import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Spinner from "../common/Spinner";
import Alert from "../common/Alert";
import Modal from "../common/Modal";
import Button from "../common/Button";
import TextInput from "../common/TextInput";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { statusMeta } from "../../utils/attendanceStatus";
import "../../styles/dashboardShared.css";

const MONTH_LABEL = (year, month) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric" });

const LEGEND = ["PRESENT", "HALF_DAY", "WFH", "ON_LEAVE", "ABSENT", "NOT_MARKED", "HOLIDAY"];

const isCurrentMonth = (year, month) => {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month;
};

function CorrectModal({ target, onClose, onDone, correctFn }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState(null);

  const submit = async (action) => {
    setError("");
    setBusyAction(action);
    try {
      await correctFn({
        userId: target.userId,
        projectId: target.projectId,
        date: target.date,
        action,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this day."));
      setBusyAction(null);
    }
  };

  const dateLabel = new Date(`${target.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Modal title="Correct attendance" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <p className="card-section-subtitle">
        <b>{target.employeeName}</b> · {target.projectName}
        <br />
        {dateLabel}
      </p>

      <TextInput
        label="Note (optional)"
        placeholder="Why this is being changed"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="modal-actions" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <Button type="button" onClick={() => submit("PRESENT")} isLoading={busyAction === "PRESENT"}>
          Present
        </Button>
        <Button type="button" variant="secondary" onClick={() => submit("HALF_DAY")} isLoading={busyAction === "HALF_DAY"}>
          Half day
        </Button>
        <Button type="button" variant="secondary" onClick={() => submit("ABSENT")} isLoading={busyAction === "ABSENT"}>
          Absent
        </Button>
      </div>
    </Modal>
  );
}

// Shared today-board + monthly grid for the manager ("Team") and admin
// ("All") attendance pages. Rows are one per (employee, project). Admin passes
// `canCorrect` + `correctFn` to enable click-to-edit cells.
export default function AttendanceRoster({ title, subtitle, fetchData, canCorrect = false, correctFn }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [correctTarget, setCorrectTarget] = useState(null);
  const [search, setSearch] = useState("");

  const goPrev = () => {
    setData(null);
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    setData(null);
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const refresh = ({ quiet } = {}) => {
    if (!quiet) setError("");
    return fetchData(year, month)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  };

  useEffect(() => {
    fetchData(year, month)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)));
  }, [fetchData, year, month]);

  // Live-ish refresh of the today board, current month only.
  useEffect(() => {
    if (!isCurrentMonth(year, month)) return undefined;
    const id = setInterval(() => refresh({ quiet: true }), 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const monthReady = data && data.month.year === year && data.month.month === month;

  const dayKeys = monthReady
    ? Array.from({ length: new Date(Date.UTC(year, month, 0)).getUTCDate() }, (_, i) =>
        new Date(Date.UTC(year, month - 1, i + 1)).toISOString().slice(0, 10)
      )
    : [];
  const weekendSet = new Set(data?.weekendDates || []);
  const fmtWorked = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const s = data?.todaySummary;

  const nameQuery = search.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const rows = data?.rows || [];
    if (!nameQuery) return rows;
    return rows.filter((row) => (row.employeeName || "").toLowerCase().includes(nameQuery));
  }, [data, nameQuery]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      {!monthReady ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : data.rows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon">
            <Users size={22} />
          </span>
          <p>No one to show here yet — attendance appears once employees are on a project.</p>
        </div>
      ) : (
        <>
          {isCurrentMonth(year, month) && s && (
            <div className="att-board-summary">
              <span>
                <b>{s.present}</b> present{s.halfDay > 0 ? ` · ${s.halfDay} half day` : ""}
              </span>
              <span>
                <b>{s.wfh}</b> WFH
              </span>
              <span>
                <b>{s.onLeave}</b> on leave
              </span>
              <span>
                <b>{s.notMarked}</b> not marked yet
              </span>
              {s.absent > 0 && (
                <span>
                  <b>{s.absent}</b> absent
                </span>
              )}
              <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>
                {data.rows.length} employee-project rows · auto-refreshes
              </span>
            </div>
          )}

          <div className="card">
            <div className="card-section">
              <div className="section-flex-row">
                <button type="button" className="link-btn" onClick={goPrev}>
                  <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Prev
                </button>
                <span className="card-section-title" style={{ marginBottom: 0 }}>
                  {MONTH_LABEL(year, month)}
                </span>
                <button type="button" className="link-btn" onClick={goNext}>
                  Next <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
                </button>
              </div>

              <div className="acct-search" style={{ marginTop: 12 }}>
                <TextInput
                  icon={<Search size={15} />}
                  placeholder="Search by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {nameQuery && (
                  <span className="acct-search-count">
                    {visibleRows.length} of {data.rows.length} rows
                  </span>
                )}
              </div>

              <div className="att-grid-wrap" style={{ marginTop: 12 }}>
                <table className="att-grid">
                  <thead>
                    <tr>
                      <th className="att-grid-namecol">Employee · Project</th>
                      {dayKeys.map((key) => {
                        const d = Number(key.slice(8, 10));
                        return (
                          <th
                            key={key}
                            className={`att-grid-daynum-th ${weekendSet.has(key) ? "is-weekend-col" : ""}`}
                          >
                            <span className={`att-grid-daynum ${key === data.todayKey ? "is-today" : ""}`}>{d}</span>
                          </th>
                        );
                      })}
                      <th className="att-grid-worked">Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 && (
                      <tr>
                        <td className="att-grid-namecol" style={{ color: "var(--text-secondary)" }}>
                          No one matches “{search.trim()}”.
                        </td>
                        {dayKeys.map((key) => (
                          <td key={key} />
                        ))}
                        <td className="att-grid-worked" />
                      </tr>
                    )}
                    {visibleRows.map((row) => (
                      <tr key={`${row.userId}-${row.projectId}`}>
                        <td className="att-grid-namecol">
                          <div className="att-grid-emp">{row.employeeName}</div>
                          <div className="att-grid-proj">{row.projectName}</div>
                        </td>
                        {row.days.map((cell) => {
                          const meta = statusMeta(cell.status);
                          const editable =
                            canCorrect &&
                            cell.date <= data.todayKey &&
                            !["WEEKEND", "HOLIDAY", "ON_LEAVE", "FUTURE"].includes(cell.status);
                          return (
                            <td key={cell.date} style={{ textAlign: "center" }}>
                              <div
                                className={`att-cell ${meta.cls} ${editable ? "is-clickable" : ""}`}
                                title={`${cell.date} — ${meta.label || "—"}`}
                                onClick={
                                  editable
                                    ? () =>
                                        setCorrectTarget({
                                          userId: row.userId,
                                          projectId: row.projectId,
                                          employeeName: row.employeeName,
                                          projectName: row.projectName,
                                          date: cell.date,
                                        })
                                    : undefined
                                }
                              >
                                {meta.short}
                              </div>
                            </td>
                          );
                        })}
                        <td className="att-grid-worked">
                          <span className="att-grid-worked-value">{fmtWorked(row.worked)}</span>
                          <span className="att-grid-worked-of"> / {row.workingDays}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="att-legend">
                {LEGEND.map((st) => {
                  const meta = statusMeta(st);
                  return (
                    <span className="att-legend-item" key={st}>
                      <span className={`att-legend-swatch ${meta.cls}`} />
                      {meta.label}
                    </span>
                  );
                })}
                {canCorrect && <span style={{ marginLeft: 8 }}>Tip: click a day to correct it.</span>}
              </div>
            </div>
          </div>
        </>
      )}

      {correctTarget && (
        <CorrectModal
          target={correctTarget}
          correctFn={correctFn}
          onClose={() => setCorrectTarget(null)}
          onDone={() => {
            setCorrectTarget(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
