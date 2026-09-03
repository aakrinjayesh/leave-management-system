import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileCheck, ListChecks, Paperclip, Save, Trash2 } from "lucide-react";
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
import { formatProjectAssigned } from "../../utils/formatProjectAssigned";
import { formatProjectType, formatWorkingHours } from "../../utils/projectOptions";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
const formatDayLabel = (date) => DAY_LABEL_FORMATTER.format(new Date(date));

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0..24

// A day can be off-limits (weekend / holiday / full-day leave) or capped
// (half-day leave). `dayConstraints` comes from the API keyed by "YYYY-MM-DD".
const CONSTRAINT_LABEL = {
  WEEKEND: "Weekend",
  HOLIDAY: "Company holiday",
  FULL_LEAVE: "On approved leave",
  HALF_LEAVE: "Half-day leave",
};
const isFullyBlocked = (c) => c && c.type !== "HALF_LEAVE";

const fmtDays = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));

// Every calendar date from periodStart to periodEnd inclusive - 7 dates for
// a WEEKLY project's Monday-Sunday grid, ~28-31 for a MONTHLY project's
// full-month grid. Same table either way, just a longer or shorter list.
const buildPeriodDates = (periodStart, periodEnd) => {
  const dates = [];
  const cursor = new Date(periodStart);
  const end = new Date(periodEnd);
  while (cursor <= end) {
    dates.push(toDateInputValue(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

export default function MyTimesheetPage() {
  const [projects, setProjects] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [weekParam, setWeekParam] = useState("");
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [rowState, setRowState] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [savingDate, setSavingDate] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // Every project the employee is assigned to gets its own independent
  // week grid, attachment, and submission - switching tabs just re-scopes
  // the same page to a different project's data.
  useEffect(() => {
    timesheetApi.listMyProjects().then((res) => {
      setProjects(res.projects);
      if (res.projects.length > 0) setActiveProjectId(res.projects[0].id);
    });
  }, []);

  // Whether the currently active project submits weekly or monthly - drives
  // the grid length, nav step, and labels below.
  const isMonthly = data?.project?.submissionFrequency === "MONTHLY";

  const loadPeriod = (param, projectId) =>
    timesheetApi.getMyEntries(param || undefined, projectId).then((res) => {
      setData(res);
      // Rebuild each row's editable state from the loaded entries - one row
      // per calendar day, blank for days with nothing saved yet.
      const entriesByDate = Object.fromEntries(res.entries.map((e) => [toDateInputValue(e.date), e]));
      const nextRowState = {};
      buildPeriodDates(res.weekStartDate, res.weekEndDate).forEach((dateKey) => {
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
  const loadSubmissions = (projectId) =>
    timesheetApi.getMySubmissions(undefined, projectId).then((res) => setSubmissions(res.submissions));

  useEffect(() => {
    if (!activeProjectId) return;
    loadPeriod(weekParam, activeProjectId);
    loadSubmissions(activeProjectId);
    setAttachment(null);
    setAttachmentError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekParam, activeProjectId]);

  const handleAttachmentChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    setAttachmentError("");
    setIsUploadingAttachment(true);
    try {
      const uploaded = await timesheetApi.uploadAttachment(file);
      setAttachment(uploaded);
    } catch (err) {
      setAttachmentError(getErrorMessage(err, "Couldn't upload this file. Please try again."));
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleDownloadSubmissionAttachment = async (submission) => {
    setError("");
    setDownloadingId(submission.id);
    try {
      const response = await timesheetApi.downloadSubmissionAttachment(submission.id);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, submission.attachmentOriginalName));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this attachment."));
    } finally {
      setDownloadingId(null);
    }
  };

  const goToPrevPeriod = () => {
    const base = new Date(data.weekStartDate);
    if (isMonthly) base.setUTCMonth(base.getUTCMonth() - 1);
    else base.setUTCDate(base.getUTCDate() - 7);
    setWeekParam(toDateInputValue(base));
  };

  const goToNextPeriod = () => {
    const base = new Date(data.weekStartDate);
    if (isMonthly) base.setUTCMonth(base.getUTCMonth() + 1);
    else base.setUTCDate(base.getUTCDate() + 7);
    setWeekParam(toDateInputValue(base));
  };

  const updateRow = (dateKey, field, value) => {
    setRowState((prev) => ({ ...prev, [dateKey]: { ...prev[dateKey], [field]: value } }));
  };

  const handleSaveEntries = async () => {
    setError("");
    setSuccessMessage("");

    const dateKeys = buildPeriodDates(data.weekStartDate, data.weekEndDate);
    const constraints = data.dayConstraints || {};
    const toSave = [];
    for (const dateKey of dateKeys) {
      const row = rowState[dateKey];
      if (row.locked) continue;

      const constraint = constraints[dateKey];
      if (isFullyBlocked(constraint)) continue;

      const hoursWorked = combineHoursMinutes(row.hours, row.minutes);
      if (hoursWorked <= 0) continue;
      if (hoursWorked > 24) {
        setError(`Hours for ${formatDayLabel(dateKey)} can't exceed 24.`);
        return;
      }
      if (constraint?.type === "HALF_LEAVE" && hoursWorked > constraint.maxHours) {
        setError(`${formatDayLabel(dateKey)} is a half-day leave — at most ${constraint.maxHours}h.`);
        return;
      }
      toSave.push({ dateKey, hoursWorked, description: row.description.trim() || undefined });
    }

    if (toSave.length === 0) {
      setError("Please enter hours for at least one day before saving.");
      return;
    }

    setSavingDate("__period__");
    try {
      await Promise.all(
        toSave.map(({ dateKey, hoursWorked, description }) =>
          timesheetApi.saveEntry({ date: dateKey, hoursWorked, description, projectId: activeProjectId })
        )
      );
      setSuccessMessage("Entries saved.");
      await loadPeriod(weekParam, activeProjectId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your entries. Please try again."));
      await loadPeriod(weekParam, activeProjectId);
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
      await loadPeriod(weekParam, activeProjectId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this entry."));
    } finally {
      setSavingDate(null);
    }
  };

  const handleSubmitPeriod = async () => {
    setError("");
    setSuccessMessage("");

    const constraints = data.dayConstraints || {};
    const badDay = Object.keys(rowState).find(
      (dateKey) => isFullyBlocked(constraints[dateKey]) && rowState[dateKey]?.id
    );
    if (badDay) {
      setError(
        `${formatDayLabel(badDay)} is ${CONSTRAINT_LABEL[constraints[badDay].type].toLowerCase()} — delete the hours logged on it before submitting.`
      );
      return;
    }

    if (!attachment) {
      setError(`Please upload ${isMonthly ? "this month's" : "this week's"} Excel sheet before submitting.`);
      return;
    }

    setSavingDate("__submit__");
    try {
      await timesheetApi.submitWeek(
        toDateInputValue(data.weekStartDate),
        attachment.attachmentOriginalName,
        attachment.attachmentStoredName,
        activeProjectId
      );
      setSuccessMessage("Timesheet submitted for approval.");
      setAttachment(null);
      await loadPeriod(weekParam, activeProjectId);
      await loadSubmissions(activeProjectId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit this timesheet."));
    } finally {
      setSavingDate(null);
    }
  };

  return (
    <DashboardLayout title="My Timesheet">
      <div className="page-header">
        <div>
          <h1>My Timesheet</h1>
          <p>Log what you worked on each day, then submit for approval.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{successMessage}</Alert>

      {!projects ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : projects.length === 0 ? (
        <div className="card">
          <div className="card-section empty-state">
            <span className="empty-state-icon">
              <ListChecks size={22} />
            </span>
            <p>You haven't been assigned a project yet - contact your admin.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="tabs" role="tablist" style={{ marginBottom: 16 }}>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="tab"
                aria-selected={activeProjectId === project.id}
                className={`tab-btn ${activeProjectId === project.id ? "active" : ""}`}
                onClick={() => setActiveProjectId(project.id)}
              >
                {project.name}
              </button>
            ))}
          </div>

          {!data ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
              <Spinner size={28} />
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-section">
                  <div className="section-flex-row">
                    <button type="button" className="link-btn" onClick={goToPrevPeriod}>
                      <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Previous {isMonthly ? "month" : "week"}
                    </button>
                    <span className="card-section-title" style={{ marginBottom: 0 }}>
                      {isMonthly ? "Month" : "Week"} of {formatDateRange(data.weekStartDate, data.weekEndDate)} —{" "}
                      {formatHoursMinutes(data.totalHours)}
                    </span>
                    <button type="button" className="link-btn" onClick={goToNextPeriod}>
                      Next {isMonthly ? "month" : "week"} <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
                    </button>
                  </div>

                  {data.dayCounts && (
                    <p className="helper-text" style={{ margin: "8px 0 0", textAlign: "center" }}>
                      Worked <strong>{fmtDays(data.dayCounts.workedDays)}</strong> of{" "}
                      <strong>{fmtDays(data.dayCounts.workingDays)}</strong> working days
                      {" "}({isMonthly ? "this month" : "this week"} — weekends, holidays and your leave excluded)
                    </p>
                  )}

                  {data.submission && (
                    <div className="remarks-note">
                      <div className="remarks-note-header">
                        <StatusBadge status={data.submission.status} />
                        <span className="remarks-note-date">Submitted {formatDate(data.submission.submittedAt)}</span>
                      </div>

                      <div className="remarks-note-meta">
                        <div className="remarks-note-meta-item">
                          <span className="remarks-note-meta-label">Project Type</span>
                          <span className="remarks-note-meta-value">
                            {formatProjectAssigned(data.submission.projectAssigned)}
                          </span>
                        </div>
                        <div className="remarks-note-meta-item">
                          <span className="remarks-note-meta-label">Project Name</span>
                          <span className="remarks-note-meta-value">{data.submission.project?.name || "—"}</span>
                        </div>
                        {data.submission.project && (
                          <div className="remarks-note-meta-item">
                            <span className="remarks-note-meta-label">Working Hours</span>
                            <span className="remarks-note-meta-value">{formatWorkingHours(data.submission.project)}</span>
                          </div>
                        )}
                      </div>

                      {data.submission.managerRemarks && (
                        <p className="remarks-note-remarks">
                          <strong>Remarks:</strong> {data.submission.managerRemarks}
                        </p>
                      )}

                      {data.submission.status === "REJECTED" && (
                        <p className="remarks-note-callout">
                          You can edit the entries below and submit this {isMonthly ? "month" : "week"} again.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-section">
                  <span className="card-section-title">{isMonthly ? "This month" : "This week"}</span>

                  {(!data.submission || data.submission.status === "REJECTED") && (
                    <div className="form-two-col" style={{ marginBottom: 20 }}>
                      <div className="field">
                        <label className="field-label">Project details</label>
                        {data.project ? (
                          <div className="info-panel">
                            <p className="info-panel-title">{formatProjectType(data.project.projectType)}</p>
                            <p className="info-panel-subtext">{formatWorkingHours(data.project)}</p>
                            <p className="info-panel-subtext">
                              {data.project.endDate
                                ? formatDateRange(data.project.startDate, data.project.endDate)
                                : `${formatDate(data.project.startDate)} – Ongoing`}
                            </p>
                          </div>
                        ) : (
                          <div className="info-panel">
                            <p className="info-panel-empty">—</p>
                          </div>
                        )}
                      </div>

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
                              <strong>Click to upload</strong> your Excel sheet
                              <span className="file-upload-box-hint">.xls or .xlsx</span>
                            </span>
                            <input
                              type="file"
                              className="file-upload-input"
                              accept=".xls,.xlsx"
                              onChange={handleAttachmentChange}
                              disabled={isUploadingAttachment}
                            />
                          </label>
                        )}

                        {isUploadingAttachment && (
                          <p className="helper-text" style={{ marginTop: 8 }}>
                            Uploading…
                          </p>
                        )}
                        {attachmentError && <Alert type="error">{attachmentError}</Alert>}

                        <p className="helper-text" style={{ marginTop: 8, marginBottom: 0 }}>
                          <Paperclip size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                          Required before submitting.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="data-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Hours</th>
                          <th>What did you work on? (optional)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {buildPeriodDates(data.weekStartDate, data.weekEndDate).map((dateKey) => {
                          const row = rowState[dateKey] || { hours: "0", minutes: "0", description: "", locked: false };
                          const isBusy = savingDate === dateKey;
                          const constraint = (data.dayConstraints || {})[dateKey];
                          const blockedDay = isFullyBlocked(constraint);
                          const hourChoices =
                            constraint?.type === "HALF_LEAVE"
                              ? HOUR_OPTIONS.filter((h) => h <= constraint.maxHours)
                              : HOUR_OPTIONS;

                          return (
                            <tr key={dateKey} className={blockedDay ? "is-disabled-row" : ""}>
                              <td className="table-cell-primary">
                                {formatDayLabel(dateKey)}
                                {constraint && (
                                  <span className="table-cell-secondary"> · {CONSTRAINT_LABEL[constraint.type]}</span>
                                )}
                              </td>
                              <td style={{ width: 100 }}>
                                {blockedDay ? (
                                  row.id ? row.hours || "0" : "—"
                                ) : row.locked ? (
                                  row.hours || "0"
                                ) : (
                                  <FormSelect value={row.hours} onChange={(e) => updateRow(dateKey, "hours", e.target.value)}>
                                    {hourChoices.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </FormSelect>
                                )}
                              </td>
                              <td className="table-cell-secondary">
                                {blockedDay ? (
                                  row.id ? (
                                    <span className="field-error">Remove — this day is off</span>
                                  ) : (
                                    "—"
                                  )
                                ) : row.locked ? (
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
                      <Button variant="secondary" onClick={handleSaveEntries} isLoading={savingDate === "__period__"}>
                        <Save size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                        Save entries
                      </Button>
                      {data.entries.length > 0 && (
                        <Button onClick={handleSubmitPeriod} isLoading={savingDate === "__submit__"}>
                          {data.submission?.status === "REJECTED" ? "Resubmit for approval" : "Submit for approval"}
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
                            <th>Period</th>
                            <th>Total hours</th>
                            <th>Sent to</th>
                            <th>Status</th>
                            <th>Project Type</th>
                            <th>Project Name</th>
                            <th>Remarks</th>
                            <th>Excel sheet</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions.map((sub) => (
                            <tr key={sub.id}>
                              <td className="table-cell-primary">
                                {formatDateRange(sub.weekStartDate, sub.weekEndDate)}
                                {sub.createdByManager && (
                                  <span className="logged-by-manager-tag">
                                    {sub.createdByAdmin ? "Logged by admin" : "Logged by manager"}
                                  </span>
                                )}
                              </td>
                              <td>{formatHoursMinutes(sub.totalHours)}</td>
                              <td className="table-cell-secondary">
                                {sub.routedTo ? `${sub.routedTo.firstName} ${sub.routedTo.lastName}` : "—"}
                              </td>
                              <td>
                                <StatusBadge status={sub.status} />
                              </td>
                              <td className="table-cell-secondary">{formatProjectAssigned(sub.projectAssigned)}</td>
                              <td className="table-cell-secondary">{sub.project?.name || "—"}</td>
                              <td className="table-cell-secondary">{sub.managerRemarks || "—"}</td>
                              <td>
                                {sub.attachmentOriginalName && (
                                  <button
                                    type="button"
                                    className="link-btn"
                                    disabled={downloadingId === sub.id}
                                    onClick={() => handleDownloadSubmissionAttachment(sub)}
                                  >
                                    <Download size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                                    {downloadingId === sub.id ? "Downloading…" : "Download"}
                                  </button>
                                )}
                              </td>
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
        </>
      )}
    </DashboardLayout>
  );
}
