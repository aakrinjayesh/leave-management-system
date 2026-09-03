import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FileCheck, Paperclip } from "lucide-react";
import Modal from "../common/Modal";
import FormSelect from "../common/FormSelect";
import TextInput from "../common/TextInput";
import Button from "../common/Button";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import { formatDateRange } from "../../utils/formatDate";
import { combineHoursMinutes, formatHoursMinutes, splitHoursMinutes } from "../../utils/formatDuration";
import { getErrorMessage } from "../../utils/getErrorMessage";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);
const DAY_LABEL = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0..24
const MINUTE_OPTIONS = [0, 15, 30, 45];

const buildPeriodDates = (start, end) => {
  const dates = [];
  const cursor = new Date(start);
  const last = new Date(end);
  while (cursor <= last) {
    dates.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

// Manager / admin "log a timesheet on the employee's behalf" modal. Same
// day-by-day grid the employee fills, but it's submitted auto-approved. The
// `api` prop supplies the three endpoints (manager vs admin):
//   getPeriod(employeeId, projectId, date) -> { projects, project, weekStartDate, weekEndDate, entries, alreadySubmitted }
//   uploadAttachment(employeeId, file)     -> { attachmentOriginalName, attachmentStoredName }
//   submit(employeeId, payload)            -> { submission }
export default function LogTimesheetModal({ employee, api, onClose, onSuccess }) {
  const [period, setPeriod] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [rows, setRows] = useState({});
  const [attachment, setAttachment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = async (nextProjectId, nextAnchor) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await api.getPeriod(employee.id, nextProjectId, nextAnchor);
      setPeriod(data);
      setProjectId(data.project?.id ?? null);

      const byDate = Object.fromEntries((data.entries || []).map((e) => [toDateInputValue(e.date), e]));
      const nextRows = {};
      if (data.weekStartDate) {
        buildPeriodDates(data.weekStartDate, data.weekEndDate).forEach((key) => {
          const entry = byDate[key];
          const { hours, minutes } = entry ? splitHoursMinutes(entry.hoursWorked) : { hours: 0, minutes: 0 };
          nextRows[key] = {
            hours: String(hours),
            minutes: String(minutes),
            description: entry?.description ?? "",
          };
        });
      }
      setRows(nextRows);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load this employee's projects."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee.id]);

  const isMonthly = period?.project?.submissionFrequency === "MONTHLY";
  const locked = Boolean(period?.alreadySubmitted);

  const shiftPeriod = (direction) => {
    if (!period?.weekStartDate) return;
    const base = new Date(period.weekStartDate);
    if (isMonthly) base.setUTCMonth(base.getUTCMonth() + direction);
    else base.setUTCDate(base.getUTCDate() + direction * 7);
    load(projectId, toDateInputValue(base));
  };

  const updateRow = (key, field, value) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const handleAttachmentChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setIsUploading(true);
    try {
      const uploaded = await api.uploadAttachment(employee.id, file);
      setAttachment(uploaded);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload this file."));
    } finally {
      setIsUploading(false);
    }
  };

  const dateKeys = period?.weekStartDate ? buildPeriodDates(period.weekStartDate, period.weekEndDate) : [];
  const totalHours = dateKeys.reduce((sum, key) => {
    const row = rows[key];
    return sum + (row ? combineHoursMinutes(row.hours, row.minutes) : 0);
  }, 0);

  const handleSubmit = async () => {
    setError("");

    const days = dateKeys.map((key) => ({
      date: key,
      hoursWorked: combineHoursMinutes(rows[key]?.hours, rows[key]?.minutes),
      description: rows[key]?.description?.trim() || undefined,
    }));

    if (!days.some((d) => d.hoursWorked > 0)) {
      setError("Enter hours for at least one day.");
      return;
    }
    if (!attachment) {
      setError(`Upload ${isMonthly ? "this month's" : "this week's"} Excel sheet before submitting.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submit(employee.id, {
        projectId,
        weekStartDate: toDateInputValue(period.weekStartDate),
        days,
        attachmentOriginalName: attachment.attachmentOriginalName,
        attachmentStoredName: attachment.attachmentStoredName,
      });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't log this timesheet."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const noProjects = period && (!period.projects || period.projects.length === 0);

  return (
    <Modal title={`Log timesheet for ${employee.firstName} ${employee.lastName}`} onClose={onClose} wide>
      <Alert type="error">{error}</Alert>

      {isLoading && !period ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Spinner size={26} />
        </div>
      ) : noProjects ? (
        <p className="helper-text" style={{ marginTop: 0 }}>
          {employee.firstName} isn't assigned to any project yet.
        </p>
      ) : (
        <>
          <p className="helper-text" style={{ marginTop: 0 }}>
            Fill in the hours for each day, attach the Excel sheet, then submit. It's recorded and{" "}
            <strong>approved immediately</strong> - no separate approval step.
          </p>

          <div className="form-two-col">
            <FormSelect
              label="Project"
              value={projectId ?? ""}
              onChange={(e) => load(Number(e.target.value), null)}
              disabled={isLoading}
            >
              {period.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FormSelect>

            <div className="field">
              <label className="field-label">{isMonthly ? "This month's" : "This week's"} Excel sheet</label>
              {attachment ? (
                <div className="attachment-uploaded-row">
                  <FileCheck size={16} />
                  <span>{attachment.attachmentOriginalName}</span>
                  <button type="button" className="link-btn" onClick={() => setAttachment(null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <label className="file-upload-box">
                  <span className="file-upload-box-icon">
                    <Paperclip size={16} />
                  </span>
                  <span className="file-upload-box-text">
                    <strong>Click to upload</strong> the Excel sheet
                    <span className="file-upload-box-hint">.xls or .xlsx</span>
                  </span>
                  <input
                    type="file"
                    className="file-upload-input"
                    accept=".xls,.xlsx"
                    onChange={handleAttachmentChange}
                    disabled={isUploading || locked}
                  />
                </label>
              )}
              {isUploading && (
                <p className="helper-text" style={{ marginTop: 8 }}>
                  Uploading…
                </p>
              )}
            </div>
          </div>

          <div className="section-flex-row" style={{ marginTop: 8 }}>
            <button type="button" className="link-btn" onClick={() => shiftPeriod(-1)} disabled={isLoading}>
              <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Previous {isMonthly ? "month" : "week"}
            </button>
            <span className="card-section-title" style={{ marginBottom: 0 }}>
              {period.weekStartDate
                ? `${formatDateRange(period.weekStartDate, period.weekEndDate)} — ${formatHoursMinutes(totalHours)}`
                : "—"}
            </span>
            <button type="button" className="link-btn" onClick={() => shiftPeriod(1)} disabled={isLoading}>
              Next {isMonthly ? "month" : "week"} <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
            </button>
          </div>

          {locked && (
            <Alert type="error">This period is already submitted for this project - pick another period.</Alert>
          )}

          <div className="data-table-wrap" style={{ marginTop: 12, maxHeight: 320, overflowY: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Hours</th>
                  <th>Mins</th>
                  <th>What did they work on? (optional)</th>
                </tr>
              </thead>
              <tbody>
                {dateKeys.map((key) => {
                  const row = rows[key] || { hours: "0", minutes: "0", description: "" };
                  return (
                    <tr key={key}>
                      <td className="table-cell-primary">{DAY_LABEL.format(new Date(key))}</td>
                      <td style={{ width: 90 }}>
                        <FormSelect
                          value={row.hours}
                          onChange={(e) => updateRow(key, "hours", e.target.value)}
                          disabled={locked}
                        >
                          {HOUR_OPTIONS.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </FormSelect>
                      </td>
                      <td style={{ width: 90 }}>
                        <FormSelect
                          value={row.minutes}
                          onChange={(e) => updateRow(key, "minutes", e.target.value)}
                          disabled={locked}
                        >
                          {MINUTE_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </FormSelect>
                      </td>
                      <td>
                        <TextInput
                          type="text"
                          placeholder="Optional"
                          value={row.description}
                          onChange={(e) => updateRow(key, "description", e.target.value)}
                          disabled={locked}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} isLoading={isSubmitting} disabled={locked || isLoading}>
              Log &amp; approve
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
