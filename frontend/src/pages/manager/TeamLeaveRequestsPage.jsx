import { useEffect, useState } from "react";
import { Check, ListChecks, Paperclip, X } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Modal from "../../components/common/Modal";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" },
];

function RejectModal({ request, onClose, onRejected }) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setError("Please explain why this request is being rejected.");
      return;
    }
    setIsSubmitting(true);
    try {
      await managerLeaveApi.rejectLeaveRequest(request.id, remarks.trim());
      onRejected();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject ${request.user.firstName}'s request`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <TextArea
          label="Reason for rejection"
          placeholder="Let them know why this request can't be approved"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Reject request
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeamLeaveRequestsPage() {
  const [filter, setFilter] = useState("PENDING");
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadRequests = () =>
    managerLeaveApi
      .getTeamLeaveRequests(filter)
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleApprove = async (request) => {
    setError("");
    setActioningId(request.id);
    try {
      await managerLeaveApi.approveLeaveRequest(request.id);
      loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this request."));
    } finally {
      setActioningId(null);
    }
  };

  const handleViewAttachment = async (id) => {
    try {
      const blob = await managerLeaveApi.downloadTeamAttachment(id);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this attachment."));
    }
  };

  return (
    <DashboardLayout title="Leave requests">
      <div className="page-header">
        <div>
          <h1>Leave requests</h1>
          <p>Review and act on leave requests from your team.</p>
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
          {!requests ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : requests.length === 0 ? (
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
                    <th>Leave type</th>
                    <th>Applied on</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="table-cell-primary">
                        {request.user.firstName} {request.user.lastName}
                      </td>
                      <td>{request.leavePolicy.leaveName}</td>
                      <td className="table-cell-secondary">{formatDate(request.createdAt)}</td>
                      <td>{formatDateRange(request.startDate, request.endDate)}</td>
                      <td>{request.totalDays}</td>
                      <td className="table-cell-secondary">{request.reason}</td>
                      <td>
                        <StatusBadge status={request.status} />
                        {request.createdByManager && (
                          <span className="logged-by-manager-tag">
                            {request.createdByAdmin ? "Logged by admin" : "Logged by manager"}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          {request.attachmentUrl && (
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => handleViewAttachment(request.id)}
                            >
                              <Paperclip size={14} />
                              Attachment
                            </button>
                          )}
                          {request.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                className="row-action-btn approve"
                                disabled={actioningId === request.id}
                                onClick={() => handleApprove(request)}
                              >
                                <Check size={14} />
                                Approve
                              </button>
                              <button
                                type="button"
                                className="row-action-btn reject"
                                disabled={actioningId === request.id}
                                onClick={() => setRejectTarget(request)}
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
          )}
        </div>
      </div>

      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onRejected={() => {
            setRejectTarget(null);
            loadRequests();
          }}
        />
      )}
    </DashboardLayout>
  );
}
