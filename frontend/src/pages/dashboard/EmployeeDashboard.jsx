import { useEffect, useState } from "react";
import { CalendarPlus, ListChecks } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import Spinner from "../../components/common/Spinner";
import ApplyLeaveModal from "../employee/ApplyLeaveModal";
import LeaveLedgerCard from "../../components/common/LeaveLedgerCard";
import { useAuth } from "../../context/AuthContext";
import * as employeeLeaveApi from "../../api/employeeLeave.api";
import { formatDateRange } from "../../utils/formatDate";
import { formatLeaveDays } from "../../utils/formatLeaveDays";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyOpen, setIsApplyOpen] = useState(false);

  const fetchSummary = () =>
    employeeLeaveApi
      .getDashboardSummary()
      .then(setSummary)
      .finally(() => setIsLoading(false));

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleApplySuccess = () => {
    setIsApplyOpen(false);
    setIsLoading(true);
    fetchSummary();
  };

  return (
    <DashboardLayout title="Dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.firstName}.</h1>
          <p>Here's where your leave balance and requests stand.</p>
        </div>
        <Button onClick={() => setIsApplyOpen(true)} className="page-header-btn">
          <CalendarPlus size={16} />
          Apply for leave
        </Button>
      </div>

      {isLoading || !summary ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div className="balance-card-grid">
            {summary.balances.map((balance) => {
              const usedPct = balance.isUnlimited
                ? 0
                : Math.min(100, Math.round((balance.usedLeaves / (balance.allocatedLeaves || 1)) * 100));
              return (
                <div className="balance-card" key={balance.leavePolicyId}>
                  <div className="balance-card-name">{balance.leaveName}</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">
                      {balance.isUnlimited ? "∞" : balance.remainingLeaves}
                    </span>
                    <span className="balance-card-total">
                      {balance.isUnlimited ? "unlimited" : `of ${formatLeaveDays(balance.allocatedLeaves)} remaining`}
                    </span>
                  </div>
                  {!balance.isUnlimited && (
                    <div className="balance-progress-track">
                      <div className="balance-progress-fill" style={{ width: `${usedPct}%` }} />
                    </div>
                  )}
                  <div className="balance-card-used">{formatLeaveDays(balance.usedLeaves)} used this year</div>
                </div>
              );
            })}
          </div>

          <LeaveLedgerCard ledgers={summary.ledgers} />

          <div className="card">
            <div className="card-section">
              <div className="section-flex-row">
                <span className="card-section-title">Recent leave requests</span>
              </div>

              {summary.recentRequests.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <ListChecks size={22} />
                  </span>
                  <p>You haven't applied for any leave yet.</p>
                </div>
              ) : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Leave type</th>
                        <th>Dates</th>
                        <th>Days</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recentRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="table-cell-primary">{request.leavePolicy.leaveName}</td>
                          <td>{formatDateRange(request.startDate, request.endDate)}</td>
                          <td>{request.totalDays}</td>
                          <td>
                            <StatusBadge status={request.status} />
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

      {isApplyOpen && <ApplyLeaveModal onClose={() => setIsApplyOpen(false)} onSuccess={handleApplySuccess} />}
    </DashboardLayout>
  );
}
