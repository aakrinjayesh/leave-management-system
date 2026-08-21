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
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,10,...,55

// The 7 calendar dates (Mon-Sun) for the week starting at weekStartDate.
const buildWeekDates = (weekStartDate) =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate);
    d.setUTCDate(d.getUTCDate() + i);
    return toDateInputValue(d);
  });

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

  const loadWeek = (param, projectId) =>
    timesheetApi.getMyEntries(param || undefined, projectId).then((res) => {
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
  const loadSubmissions = (projectId) =>
    timesheetApi.getMySubmissions(undefined, projectId).then((res) => setSubmissions(res.submissions));

  useEffect(() => {
    if (!activeProjectId) return;
    loadWeek(weekParam, activeProjectId);
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
          timesheetApi.saveEntry({ date: dateKey, hoursWorked, description, projectId: activeProjectId })
        )
      );
      setSuccessMessage("Week saved.");
      await loadWeek(weekParam, activeProjectId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the week. Please try again."));
      await loadWeek(weekParam, activeProjectId);
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
      await loadWeek(weekParam, activeProjectId);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't delete this entry."));
    } finally {
      setSavingDate(null);
    }
  };

  const handleSubmitWeek = async () => {
    setError("");
    setSuccessMessage("");

    if (!attachment) {
      setError("Please upload this week's Excel sheet before submitting.");
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
      await loadWeek(weekParam, activeProjectId);
      await loadSubmissions(activeProjectId);
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
                      {" Project Type: "}
                      {formatProjectAssigned(data.submission.projectAssigned)}.
                      {" Project Name: "}
                      {data.submission.project?.name || "—"}.
                      {data.submission.project && ` Working hours: ${formatWorkingHours(data.submission.project)}.`}
                      {data.submission.managerRemarks ? ` Remarks: ${data.submission.managerRemarks}` : ""}
                      {data.submission.status === "REJECTED" && " You can edit the entries below and submit this week again."}
                    </div>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-section">
                  <span className="card-section-title">This week</span>

                  {(!data.submission || data.submission.status === "REJECTED") && (
                    <div className="form-two-col" style={{ marginBottom: 20 }}>
                      <div className="field">
                        <label className="field-label">Project details</label>
                        {data.project ? (
                          <p className="helper-text" style={{ marginTop: 8 }}>
                            {formatProjectType(data.project.projectType)}
                            <br />
                            {formatWorkingHours(data.project)}
                          </p>
                        ) : (
                          <p className="helper-text" style={{ marginTop: 8 }}>
                            —
                          </p>
                        )}
                      </div>

                      <div className="field">
                        <label className="field-label">This week's Excel sheet</label>

                        {attachment ? (
                          <div className="attachment-uploaded-row">
                            <FileCheck size={16} />
                            <span>{attachment.attachmentOriginalName}</span>
                            <button type="button" className="link-btn" onClick={() => setAttachment(null)}>
                              Remove
                            </button>
                          </div>
                        ) : (
                          <input
                            type="file"
                            className="field-input"
                            accept=".xls,.xlsx"
                            onChange={handleAttachmentChange}
                            disabled={isUploadingAttachment}
                          />
                        )}

                        {isUploadingAttachment && (
                          <p className="helper-text" style={{ marginTop: 0 }}>
                            Uploading…
                          </p>
                        )}
                        {attachmentError && <Alert type="error">{attachmentError}</Alert>}

                        <p className="helper-text" style={{ marginTop: 0 }}>
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
                            <th>Project Type</th>
                            <th>Project Name</th>
                            <th>Remarks</th>
                            <th>Excel sheet</th>
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
