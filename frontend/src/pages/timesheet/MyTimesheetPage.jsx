import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks, Save, Trash2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import StatusBadge from "../../components/common/StatusBadge";
import * as timesheetApi from "../../api/employeeTimesheet.api";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { combineHoursMinutes, formatHoursMinutes, splitHoursMinutes } from "../../utils/formatDuration";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const formatDayLabel = (date) => DAY_LABEL_FORMATTER.format(new Date(date));

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0..24
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...,55

// The 7 calendar dates (Mon-Sun) for the week starting at weekStartDate.
const buildWeekDates = (weekStartDate) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setUTCDate(d.getUTCDate() + i);
    return toDateInputValue(d);
  });

export default function MyTimesheetPage() {
  const [weekParam, setWeekParam] = useState("");
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [rowState, setRowState] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [savingDate, setSavingDate] = useState(null);

  const loadWeek = (param) =>
    timesheetApi.getMyEntries(param || undefined).then((res) => {
      setData(res);
      // Rebuild each row's editable state from the loaded entries - one row
      // per calendar day, blank for days with nothing saved yet.
      const entriesByDate = Object.fromEntries(res.entries.map((e) => [toDateInputValue(e.date), e]));
      const nextRowState = {};
      buildWeekDates(res.weekStartDate).forEach((dateKey) => {
        const entry = entriesByDate[dateKey];
        const { hours, minutes } = entry ? splitHoursMinutes(entry.hoursWorked) : { hours: 0, minutes: 0 };
        nextRowState[dateKey] = {
          id: entry?.id ?? null,
          hours: String(hours),
          minutes: String(minutes),
          description: entry?.description ?? "",
          locked: Boolean(entry?.timesheetSubmissionId),
        };
      });
      setRowState(nextRowState);
    });
  const loadSubmissions = () => timesheetApi.getMySubmissions().then((res) => setSubmissions(res.submissions));

  useEffect(() => {
    loadWeek(weekParam);
  }, [weekParam]);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const goToPrevWeek = () => {
    const base = new Date(data.weekStartDate);
    base.setUTCDate(base.getUTCDate() - 7);
    setWeekParam(toDateInputValue(base));
  };

  const goToNextWeek = () => {
    const base = new Date(data.weekStartDate);
    base.setUTCDate(base.getUTCDate() + 7);
    setWeekParam(toDateInputValue(base));
  };

  const updateRow = (dateKey, field, value) => {
    setRowState((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], [field]: value } }));
  };

  const handleSaveWeek = async () => {
    setError("");
    setSuccessMessage("");

    const dateKeys = buildWeekDates(data.weekStartDate);
    const toSave = [];
    for (const dateKey of dateKeys) {
      const row = rowState[dateKey];
      if (row.locked) continue;

      const minutes = Number(row.minutes) || 0;
      if (minutes < 0 || minutes > 59) {
        setError(`Minutes for ${formatDayLabel(dateKey)} must be between 0 and 59.`);
        return;
      }
      const hoursWorked = combineHoursMinutes(row.hours, row.minutes);
      if (hoursWorked <= 0) continue;
      if (hoursWorked > 24) {
        setError(`Hours for ${formatDayLabel(dateKey)} can't exceed 24.`);
        return;
      }
      toSave.push({ dateKey, hoursWorked, description: row.description.trim() || undefined });
    }

    if (toSave.length === 0) {
      setError("Please enter hours or minutes for at least one day before saving.");
      return;
    }

    setSavingDate("__week__");
    try {
      await Promise.all(
        toSave.map(({ dateKey, hoursWorked, description }) =>
          timesheetApi.saveEntry({ date: dateKey, hoursWorked, description })
        )
      );
      setSuccessMessage("Week saved.");
      await loadWeek(weekParam);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the week. Please try again."));
      await loadWeek(weekParam);
    } finally {
      setSavingDate(null);
    }
  };

  const handleDeleteRow = async (dateKey) => {
    setError("");
    const row = rowState[dateKey];
    if (!row.id) return;

    setSavingDate(dateKey);
    try {
      await timesheetApi.deleteEntry(row.id);
      await loadWeek(weekParam);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this entry."));
    } finally {
      setSavingDate(null);
    }
  };

  const handleSubmitWeek = async () => {
    setError("");
    setSuccessMessage("");
    setSavingDate("__submit__");
    try {
      await timesheetApi.submitWeek(toDateInputValue(data.weekStartDate));
      setSuccessMessage("Timesheet submitted for approval.");
      await loadWeek(weekParam);
      await loadSubmissions();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit this week's timesheet."));
    } finally {
      setSavingDate(null);
    }
  };

  return (
    <DashboardLayout title="My Timesheet">
      <div className="page-header">
        <div>
          <h1>My Timesheet</h1>
          <p>Log what you worked on each day, then submit the week for approval.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{successMessage}</Alert>

      {!data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-section">
              <div className="section-flex-row">
                <button type="button" className="link-btn" onClick={goToPrevWeek}>
                  <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Previous week
                </button>
                <span className="card-section-title" style={{ marginBottom: 0 }}>
                  Week of {formatDateRange(data.weekStartDate, data.weekEndDate)} — {formatHoursMinutes(data.totalHours)}
                </span>
                <button type="button" className="link-btn" onClick={goToNextWeek}>
                  Next week <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
                </button>
              </div>

              {data.submission && (
                <div className="remarks-note">
                  <StatusBadge status={data.submission.status} /> Submitted {formatDate(data.submission.submittedAt)}.
                  {data.submission.managerRemarks ? ` Remarks: ${data.submission.managerRemarks}` : ""}
                  {data.submission.status === "REJECTED" && " You can edit the entries below and submit this week again."}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-section">
              <span className="card-section-title">This week</span>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Hours</th>
                      <th>Minutes</th>
                      <th>What did you work on? (optional)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildWeekDates(data.weekStartDate).map((dateKey) => {
                      const row = rowState[dateKey] || { hours: "0", minutes: "0", description: "", locked: false };
                      const isBusy = savingDate === dateKey;

                      return (
                        <tr key={dateKey}>
                          <td className="table-cell-primary">{formatDayLabel(dateKey)}</td>
                          <td style={{ width: 100 }}>
                            {row.locked ? (
                              row.hours || "0"
                            ) : (
                              <FormSelect value={row.hours} onChange={(e) => updateRow(dateKey, "hours", e.target.value)}>
                                {HOUR_OPTIONS.map((h) => (
                                  <option key={h} value={h}>
                                    {h}
                                  </option>
                                ))}
                              </FormSelect>
                            )}
                          </td>
                          <td style={{ width: 100 }}>
                            {row.locked ? (
                              row.minutes || "0"
                            ) : (
                              <FormSelect value={row.minutes} onChange={(e) => updateRow(dateKey, "minutes", e.target.value)}>
                                {MINUTE_OPTIONS.map((m) => (
                                  <option key={m} value={m}>
                                    {m}
                                  </option>
                                ))}
                              </FormSelect>
                            )}
                          </td>
                          <td className="table-cell-secondary">
                            {row.locked ? (
                              row.description || "—"
                            ) : (
                              <TextInput
                                type="text"
                                placeholder="Optional"
                                value={row.description}
                                onChange={(e) => updateRow(dateKey, "description", e.target.value)}
                              />
                            )}
                          </td>
                          <td>
                            {!row.locked && row.id && (
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="row-action-btn reject"
                                  disabled={isBusy}
                                  onClick={() => handleDeleteRow(dateKey)}
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(!data.submission || data.submission.status === "REJECTED") && (
                <div className="modal-actions" style={{ marginTop: 20, justifyContent: "flex-start", gap: 10 }}>
                  <Button variant="secondary" onClick={handleSaveWeek} isLoading={savingDate === "__week__"}>
                    <Save size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                    Save week
                  </Button>
                  {data.entries.length > 0 && (
                    <Button onClick={handleSubmitWeek} isLoading={savingDate === "__submit__"}>
                      {data.submission?.status === "REJECTED" ? "Resubmit week" : "Submit week"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-section">
              <span className="card-section-title">Past submissions</span>

              {!submissions ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <Spinner size={24} />
                </div>
              ) : submissions.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <ListChecks size={22} />
                  </span>
                  <p>No timesheets submitted yet.</p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Week</th>
                        <th>Total hours</th>
                        <th>Sent to</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="table-cell-primary">{formatDateRange(sub.weekStartDate, sub.weekEndDate)}</td>
                          <td>{formatHoursMinutes(sub.totalHours)}</td>
                          <td className="table-cell-secondary">
                            {sub.routedTo ? `${sub.routedTo.firstName} ${sub.routedTo.lastName}` : "—"}
                          </td>
                          <td>
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="table-cell-secondary">{sub.managerRemarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
