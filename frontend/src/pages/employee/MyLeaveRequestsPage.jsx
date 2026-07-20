import { useEffect, useState } from "react";
import { CalendarPlus, Ban, ListChecks, Paperclip } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import ApplyLeaveModal from "./ApplyLeaveModal";
import * as employeeLeaveApi from "../../api/employeeLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const isCancellable = (request) => request.status === "PENDING";

export default function MyLeaveRequestsPage() {
  const [filter, setFilter] = useState("");
  const [requests, setRequests] = useState(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  const loadRequests = () =>
    employeeLeaveApi
      .getMyLeaveRequests(filter)
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleCancel = async (id) => {
    setError("");
    setCancellingId(id);
    try {
      await employeeLeaveApi.cancelLeaveRequest(id);
      loadRequests();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't cancel this request."));
    } finally {
      setCancellingId(null);
    }
  };

  const handleApplySuccess = () => {
    setIsApplyOpen(false);
    loadRequests();
  };

  const handleViewAttachment = async (id) => {
    try {
      const blob = await employeeLeaveApi.downloadMyAttachment(id);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this attachment."));
    }
  };

  return (
    <DashboardLayout title="My leave requests">
      <div className="page-header">
        <div>
          <h1>My leave requests</h1>
          <p>Track the status of every request you've submitted.</p>
        </div>
        <Button onClick={() => setIsApplyOpen(true)} className="page-header-btn">
          <CalendarPlus size={16} />
          Apply for leave
        </Button>
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
          {requests === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>No leave requests here yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave type</th>
                    <th>Sent to</th>
                    <th>Applied on</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td className="table-cell-primary">{request.leavePolicy.leaveName}</td>
                      <td className="table-cell-secondary">
                        {request.routedTo ? `${request.routedTo.firstName} ${request.routedTo.lastName}` : "—"}
                      </td>
                      <td className="table-cell-secondary">{formatDate(request.createdAt)}</td>
                      <td>{formatDateRange(request.startDate, request.endDate)}</td>
                      <td>{request.totalDays}</td>
                      <td className="table-cell-secondary">{request.reason}</td>
                      <td>
                        <StatusBadge status={request.status} />
                        {request.createdByManager && <span className="logged-by-manager-tag">Logged by manager</span>}
                      </td>
                      <td className="table-cell-secondary">{request.managerRemarks || "—"}</td>
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
                          {isCancellable(request) && (
                            <button
                              type="button"
                              className="row-action-btn reject"
                              disabled={cancellingId === request.id}
                              onClick={() => handleCancel(request.id)}
                            >
                              <Ban size={14} />
                              Cancel
                            </button>
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

      {isApplyOpen && <ApplyLeaveModal onClose={() => setIsApplyOpen(false)} onSuccess={handleApplySuccess} />}
    </DashboardLayout>
  );
}
