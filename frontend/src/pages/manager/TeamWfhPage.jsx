import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Home } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

export default function TeamWfhPage() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    managerLeaveApi
      .getTeamWfhRequests()
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  return (
    <DashboardLayout title="WFH Requests">
      <div className="page-header">
        <div>
          <h1>WFH Requests</h1>
          <p>Work-from-home requests submitted by your team - view only, admin manages approval.</p>
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
