import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Download, ListChecks, X } from "lucide-react";
import Spinner from "../common/Spinner";
import Alert from "../common/Alert";
import StatusBadge from "../common/StatusBadge";
import Modal from "../common/Modal";
import TextArea from "../common/TextArea";
import Button from "../common/Button";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { formatHoursMinutes } from "../../utils/formatDuration";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatProjectAssigned } from "../../utils/formatProjectAssigned";
import "../../styles/dashboardShared.css";

function RejectModal({ submission, onClose, onRejected, reject }) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError("Please explain why this timesheet is being rejected.");
      return;
    }
    setIsSubmitting(true);
    try {
      await reject(submission.id, remarks.trim());
      onRejected();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Reject this timesheet" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <TextArea
          label="Reason for rejection"
          placeholder="Let them know why this timesheet can't be approved"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Reject timesheet
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const VIEWS = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

// Shared by the manager and admin "view one person's timesheet" pages - only
// difference between them is which API calls fetch/export the data, passed
// in as `fetchTimesheet(view, dateString, projectId) => Promise`,
// `exportTimesheet(view, dateString, projectId) => Promise<AxiosResponse>` (optional),
// and `downloadAttachment(submissionId) => Promise<AxiosResponse>` (optional)
// for the Excel sheet the employee attached to a given week's submission.
export default function TimesheetDetailView({
  fetchTimesheet,
  exportTimesheet,
  downloadAttachment,
  decisionApi,
  onDataLoad,
}) {
  // A caller can deep-link straight to a specific week/day via ?date=... in
  // the URL (e.g. from a WFH request row) - defaults to today when absent.
  const [searchParams] = useSearchParams();
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(searchParams.get("date") || toDateInputValue(new Date()));
  // Null until the first response tells us which project the backend
  // resolved (the employee's first project, unless one is picked below).
  const [projectId, setProjectId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    fetchTimesheet(view, anchorDate, projectId).then((res) => {
      setData(res);
      if (res.projectId !== projectId) setProjectId(res.projectId);
      if (onDataLoad) onDataLoad(res.employee);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDate, projectId, reloadKey]);

  const handleApprove = async (submission) => {
    setError("");
    setActioningId(submission.id);
    try {
      await decisionApi.approve(submission.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this timesheet."));
    } finally {
      setActioningId(null);
    }
  };

  const shiftAnchor = (direction) => {
    const date = new Date(anchorDate);
    if (view === "day") date.setUTCDate(date.getUTCDate() + direction);
    else if (view === "week") date.setUTCDate(date.getUTCDate() + direction * 7);
    else date.setUTCMonth(date.getUTCMonth() + direction);
    setAnchorDate(toDateInputValue(date));
  };

  const handleExport = async () => {
    setError("");
    setIsExporting(true);
    try {
      const response = await exportTimesheet(view, anchorDate, projectId);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, "timesheet.csv"));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't export this timesheet."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAttachment = async (submission) => {
    setError("");
    setDownloadingId(submission.id);
    try {
      const response = await downloadAttachment(submission.id);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, submission.attachmentOriginalName));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this attachment."));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <Spinner size={28} />
      </div>
    );
  }

  if (data.projects && data.projects.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon">
          <ListChecks size={22} />
        </span>
        <p>Not assigned to any project yet.</p>
      </div>
    );
  }

  return (
    <>
      <Alert type="error">{error}</Alert>

      {data.projects && data.projects.length > 1 && (
        <div className="tabs" style={{ marginBottom: 16 }}>
          {data.projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`tab-btn ${projectId === project.id ? "active" : ""}`}
              onClick={() => setProjectId(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      <div className="filter-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            className={`filter-tab ${view === v.value ? "active" : ""}`}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <div className="section-flex-row">
            <button type="button" className="link-btn" onClick={() => shiftAnchor(-1)}>
              <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Previous
            </button>
            <span className="card-section-title" style={{ marginBottom: 0 }}>
              {formatDateRange(data.rangeStart, data.rangeEnd)} — {formatHoursMinutes(data.totalHours)}
            </span>
            <button type="button" className="link-btn" onClick={() => shiftAnchor(1)}>
              Next <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          <div className="section-flex-row">
            <span className="card-section-title" style={{ marginBottom: 0 }}>
              Entries
            </span>
            {exportTimesheet && (
              <button type="button" className="link-btn" onClick={handleExport} disabled={isExporting}>
                <Download size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {isExporting ? "Exporting…" : "Export CSV"}
              </button>
            )}
          </div>

          {data.entries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>No submitted entries in this range.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="table-cell-primary">{formatDate(entry.date)}</td>
                      <td>{formatHoursMinutes(entry.hoursWorked)}</td>
                      <td className="table-cell-secondary">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(downloadAttachment || decisionApi) && data.submissions?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Weekly submissions</span>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Hours</th>
                    <th>Project Type</th>
                    <th>Project Name</th>
                    {decisionApi && <th>Status</th>}
                    <th>Excel sheet</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((submission) => (
                    <tr key={submission.id}>
                      <td className="table-cell-primary">
                        {formatDateRange(submission.weekStartDate, submission.weekEndDate)}
                      </td>
                      <td>{formatHoursMinutes(submission.totalHours)}</td>
                      <td className="table-cell-secondary">{formatProjectAssigned(submission.projectAssigned)}</td>
                      <td className="table-cell-secondary">{submission.project?.name || "—"}</td>
                      {decisionApi && (
                        <td>
                          <StatusBadge status={submission.status} />
                        </td>
                      )}
                      <td className="table-cell-secondary">{submission.attachmentOriginalName || "—"}</td>
                      <td>
                        <div className="row-actions">
                          {submission.attachmentOriginalName && downloadAttachment && (
                            <button
                              type="button"
                              className="link-btn"
                              disabled={downloadingId === submission.id}
                              onClick={() => handleDownloadAttachment(submission)}
                            >
                              <Download size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                              {downloadingId === submission.id ? "Downloading…" : "Download"}
                            </button>
                          )}
                          {decisionApi && submission.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                className="row-action-btn approve"
                                disabled={actioningId === submission.id}
                                onClick={() => handleApprove(submission)}
                              >
                                <Check size={14} />
                                Approve
                              </button>
                              <button
                                type="button"
                                className="row-action-btn reject"
                                disabled={actioningId === submission.id}
                                onClick={() => setRejectTarget(submission)}
                              >
                                <X size={14} />
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          submission={rejectTarget}
          reject={decisionApi.reject}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}
