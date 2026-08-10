import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, ListChecks, Paperclip } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import StatCard from "../../components/common/StatCard";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import Calendar from "../../components/common/Calendar";
import LeaveLedgerCard from "../../components/common/LeaveLedgerCard";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as adminApi from "../../api/admin.api";
import { formatDateRange } from "../../utils/formatDate";
import { formatLeaveDays } from "../../utils/formatLeaveDays";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const toDateKey = (input) => new Date(input).toISOString().slice(0, 10);

// Counts approved leave days that actually fall within the viewed month
// (clipping requests that span a month boundary), skipping weekends/holidays
// the same way the calendar itself does - so it matches what's painted.
const countLeaveDaysInMonth = (leaves, year, month, weekendDates, holidays) => {
  const weekendSet = new Set(weekendDates);
  const holidaySet = new Set(holidays.map((h) => h.date));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  let total = 0;
  for (const leave of leaves) {
    const isHalfDay = leave.totalDays === 0.5;
    const start = new Date(leave.startDate) < monthStart ? monthStart : new Date(leave.startDate);
    const end = new Date(leave.endDate) > monthEnd ? monthEnd : new Date(leave.endDate);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));

    while (cursor <= last) {
      const key = toDateKey(cursor);
      if (!weekendSet.has(key) && !holidaySet.has(key)) {
        total += isHalfDay ? 0.5 : 1;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return total;
};

export default function EmployeeLeaveDetailPage() {
  const { id } = useParams();
  // Keyed by id so switching employees remounts this component (fresh state)
  // instead of briefly showing the previous employee's data while loading.
  return <EmployeeLeaveDetailContent key={id} id={id} />;
}

function EmployeeLeaveDetailContent({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const { year, month, goToPrevMonth, goToNextMonth } = useMonthNavigation();
  const [calendarData, setCalendarData] = useState(null);

  useEffect(() => {
    adminApi.getUserLeaveDetail(id).then(setData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setCalendarData(null);
    adminApi.getUserCalendar(id, year, month).then(setCalendarData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, year, month]);

  const handleViewAttachment = async (requestId) => {
    setError("");
    try {
      const blob = await adminApi.downloadLeaveAttachment(requestId);
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this attachment."));
    }
  };

  if (!data) {
    return (
      <DashboardLayout title="Employee Leave">
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      </DashboardLayout>
    );
  }

  const { employee, balances, leaveRequests, ledgers } = data;

  return (
    <DashboardLayout title="Employee Leave">
      <button type="button" className="link-btn" style={{ marginBottom: 16 }} onClick={() => navigate("/admin/dashboard")}>
        <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Back to accounts
      </button>

      <div className="page-header">
        <div>
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p>{employee.email}</p>
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

      {calendarData && (
        <>
          <div className="stat-card-grid">
            <StatCard
              icon={<CalendarDays size={20} />}
              label={`Leave days taken in ${new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric" })}`}
              value={countLeaveDaysInMonth(calendarData.leaves, year, month, calendarData.weekendDates, calendarData.holidays)}
            />
          </div>

          <Calendar
            year={year}
            month={month}
            weekendDates={calendarData.weekendDates}
            holidays={calendarData.holidays}
            leaveEntries={calendarData.leaves.map((leave) => ({
              startDate: leave.startDate,
              endDate: leave.endDate,
              status: leave.status,
              label: leave.leavePolicy.leaveName,
            }))}
            onPrevMonth={goToPrevMonth}
            onNextMonth={goToNextMonth}
          />
        </>
      )}

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
    </DashboardLayout>
  );
}
