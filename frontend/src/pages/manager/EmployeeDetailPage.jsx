import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarPlus, Clock, ListChecks, Paperclip } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import LogLeaveForEmployeeModal from "./LogLeaveForEmployeeModal";
import LeaveLedgerCard from "../../components/common/LeaveLedgerCard";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { formatDateRange } from "../../utils/formatDate";
import { formatLeaveDays } from "../../utils/formatLeaveDays";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

export default function EmployeeDetailPage() {
  const { id } = useParams();
  // Keyed by id so switching employees remounts this component (fresh state)
  // instead of briefly showing the previous employee's data while loading.
  return <EmployeeDetailContent key={id} id={id} />;
}

function EmployeeDetailContent({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [error, setError] = useState("");

  const loadDetail = () => managerLeaveApi.getEmployeeDetail(id).then(setData);

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleLogSuccess = () => {
    setIsLogOpen(false);
    loadDetail();
  };

  const handleViewAttachment = async (requestId) => {
    setError("");
    try {
      const blob = await managerLeaveApi.downloadTeamAttachment(requestId);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this attachment."));
    }
  };

  if (!data) {
    return (
      <DashboardLayout title="Employee">
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      </DashboardLayout>
    );
  }

  const { employee, balances, leaveRequests, ledgers } = data;

  return (
    <DashboardLayout title="Employee">
      <div className="page-header">
        <div>
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p>{employee.email}</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="secondary"
            onClick={() => navigate(`/manager/timesheets/employees/${employee.id}`)}
            className="page-header-btn"
          >
            <Clock size={16} />
            Timesheet
          </Button>
          <Button onClick={() => setIsLogOpen(true)} className="page-header-btn">
            <CalendarPlus size={16} />
            Log leave
          </Button>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="balance-card-grid">
        {balances.map((balance) => (
          <div className="balance-card" key={balance.leaveName}>
            <div className="balance-card-name">{balance.leaveName}</div>
            <div className="balance-card-numbers">
              <span className="balance-card-remaining">{balance.remainingLeaves}</span>
              <span className="balance-card-total">of {formatLeaveDays(balance.allocatedLeaves)} remaining</span>
            </div>
            <div className="balance-progress-track">
              <div
                className="balance-progress-fill"
                style={{ width: `${Math.min(100, Math.round((balance.usedLeaves / (balance.allocatedLeaves || 1)) * 100))}%` }}
              />
            </div>
            <div className="balance-card-used">{formatLeaveDays(balance.usedLeaves)} used this year</div>
          </div>
        ))}
      </div>

      <LeaveLedgerCard ledgers={ledgers} />

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Leave history</span>

          {leaveRequests.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>No leave requests from this employee yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Handled by</th>
                    <th>Remarks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {leaveRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="table-cell-primary">{request.leavePolicy.leaveName}</td>
                      <td>{formatDateRange(request.startDate, request.endDate)}</td>
                      <td>{request.totalDays}</td>
                      <td className="table-cell-secondary">{request.reason}</td>
                      <td>
                        <StatusBadge status={request.status} />
                        {request.createdByManager && <span className="logged-by-manager-tag">Logged by manager</span>}
                      </td>
                      <td className="table-cell-secondary">
                        {request.approvedBy
                          ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}`
                          : request.routedTo
                            ? `${request.routedTo.firstName} ${request.routedTo.lastName}`
                            : "—"}
                      </td>
                      <td className="table-cell-secondary">{request.managerRemarks || "—"}</td>
                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isLogOpen && (
        <LogLeaveForEmployeeModal employee={employee} onClose={() => setIsLogOpen(false)} onSuccess={handleLogSuccess} />
      )}
    </DashboardLayout>
  );
}
