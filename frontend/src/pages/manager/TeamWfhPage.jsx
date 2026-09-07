import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Clock, Home, X } from "lucide-react";
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

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

function RejectModal({ request, onClose, onRejected }) {
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (remarks.trim().length < 3) {
      setError("Please explain why this WFH request is being rejected.");
      return;
    }
    setIsSubmitting(true);
    try {
      await managerLeaveApi.rejectTeamWfhRequest(request.id, remarks.trim());
      onRejected();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Reject ${request.user.firstName}'s WFH request`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <TextArea
          label="Reason for rejection"
          placeholder="Let them know why this can't be approved"
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

export default function TeamWfhPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const loadRequests = () =>
    managerLeaveApi
      .getTeamWfhRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (request) => {
    setError("");
    setActioningId(request.id);
    try {
      await managerLeaveApi.approveTeamWfhRequest(request.id);
      await loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this WFH request."));
    } finally {
      setActioningId(null);
    }
  };

  return (
    <DashboardLayout title="WFH Requests">
      <div className="page-header">
        <div>
          <h1>WFH Requests</h1>
          <p>Work-from-home requests from your team - approve or reject your direct reports&apos; requests.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="card">
        <div className="card-section">
          {!requests ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Home size={22} />
              </span>
              <p>Nothing here.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Working on</th>
                    <th>Dates</th>
                    <th>Reason</th>
                    <th>Submitted on</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="table-cell-primary">
                        {request.user.firstName} {request.user.lastName}
                      </td>
                      <td className="table-cell-secondary">
                        {request.user.projectMemberships?.length > 0
                          ? request.user.projectMemberships.map((m) => m.project.name).join(", ")
                          : "—"}
                      </td>
                      <td>{formatDateRange(request.startDate, request.endDate)}</td>
                      <td className="table-cell-secondary">{request.reason}</td>
                      <td className="table-cell-secondary">{formatDate(request.createdAt)}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="table-cell-secondary">{request.adminRemarks || "—"}</td>
                      <td>
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() =>
                            navigate(
                              `/manager/timesheets/employees/${request.user.id}?date=${toDateInputValue(request.startDate)}`
                            )
                          }
                        >
                          <Clock size={14} />
                          View Timesheet
                        </button>
                      </td>
                      <td>
                        {request.status === "PENDING" && (
                          <div className="row-actions">
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
