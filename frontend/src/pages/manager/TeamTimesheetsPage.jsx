import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ListChecks, X } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Modal from "../../components/common/Modal";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import * as managerTimesheetApi from "../../api/managerTimesheet.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { formatHoursMinutes } from "../../utils/formatDuration";
import "../../styles/dashboardShared.css";

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" },
];

function RejectModal({ submission, onClose, onRejected }) {
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
      await managerTimesheetApi.rejectSubmission(submission.id, remarks.trim());
      onRejected();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject ${submission.user.firstName}'s timesheet`} onClose={onClose}>
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

export default function TeamTimesheetsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("PENDING");
  const [submissions, setSubmissions] = useState(null);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadSubmissions = () =>
    managerTimesheetApi
      .getTeamSubmissions(filter)
      .then((data) => setSubmissions(data.submissions))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleApprove = async (submission) => {
    setError("");
    setActioningId(submission.id);
    try {
      await managerTimesheetApi.approveSubmission(submission.id);
      loadSubmissions();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this timesheet."));
    } finally {
      setActioningId(null);
    }
  };

  return (
    <DashboardLayout title="Team timesheets">
      <div className="page-header">
        <div>
          <h1>Team timesheets</h1>
          <p>Review and act on weekly timesheets submitted by your team.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`filter-tab ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-section">
          {!submissions ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>Nothing here.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Project</th>
                    <th>Week</th>
                    <th>Submitted on</th>
                    <th>Total hours</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="is-clickable"
                      onClick={() => navigate(`/manager/timesheets/employees/${submission.user.id}`)}
                    >
                      <td className="table-cell-primary">
                        {submission.user.firstName} {submission.user.lastName}
                      </td>
                      <td className="table-cell-secondary">{submission.project?.name || "—"}</td>
                      <td>{formatDateRange(submission.weekStartDate, submission.weekEndDate)}</td>
                      <td className="table-cell-secondary">{formatDate(submission.submittedAt)}</td>
                      <td>{formatHoursMinutes(submission.totalHours)}</td>
                      <td>
                        <StatusBadge status={submission.status} />
                        {submission.createdByManager && (
                          <span className="logged-by-manager-tag">
                            {submission.createdByAdmin ? "Logged by admin" : "Logged by manager"}
                          </span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {submission.status === "PENDING" && (
                          <div className="row-actions">
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
                          </div>
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

      {rejectTarget && (
        <RejectModal
          submission={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            loadSubmissions();
          }}
        />
      )}
    </DashboardLayout>
  );
}
