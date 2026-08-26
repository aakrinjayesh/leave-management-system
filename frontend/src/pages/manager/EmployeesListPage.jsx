import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, ClockAlert, CalendarOff, Home, Users } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import StatCard from "../../components/common/StatCard";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { formatDate } from "../../utils/formatDate";
import "../../styles/dashboardShared.css";

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(null);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    managerLeaveApi.getEmployees().then((data) => setEmployees(data.employees));
    managerLeaveApi.getOverview().then(setOverview);
  }, []);

  return (
    <DashboardLayout title="Employees">
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p>Everyone who reports to you, with their usage and balance.</p>
        </div>
      </div>

      {overview && (
        <div className="stat-card-grid">
          <StatCard icon={<Users size={20} />} label="Total employees" value={overview.totalEmployees} />
          <StatCard
            icon={<ClockAlert size={20} />}
            label="Pending requests"
            value={overview.pendingRequestsCount}
            onClick={() => navigate("/manager/leave-requests")}
          />
          <StatCard icon={<CalendarOff size={20} />} label="On leave today" value={overview.onLeaveTodayCount} />
          <StatCard
            icon={<Home size={20} />}
            label="WFH today"
            value={overview.wfhTodayCount}
            onClick={() => navigate("/manager/wfh-requests")}
          />
        </div>
      )}

      <div className="card">
        <div className="card-section">
          {!employees ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : employees.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Users size={22} />
              </span>
              <p>No one reports to you yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Project</th>
                    <th>Days used</th>
                    <th>Days remaining</th>
                    <th>Pending requests</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="is-clickable"
                      onClick={() => navigate(`/manager/employees/${employee.id}`)}
                    >
                      <td className="table-cell-primary">
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td
                        style={{ whiteSpace: "normal", minWidth: 220, cursor: "default" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {employee.projects.length === 0 ? (
                          <span className="table-cell-secondary">Not on a project</span>
                        ) : (
                          <div className="project-chip-list">
                            {employee.projects.map((p, i) => (
                              <div key={i} className="project-chip">
                                <span className="project-chip-name">{p.projectName}</span>
                                <span className="project-chip-meta">
                                  Started {formatDate(p.projectStartDate)} · Assigned {formatDate(p.assignedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{employee.totalUsed}</td>
                      <td>{employee.totalRemaining}</td>
                      <td>{employee.pendingRequestsCount}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => navigate(`/manager/timesheets/employees/${employee.id}`)}
                          >
                            <Clock size={14} />
                            Timesheet
                          </button>
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
    </DashboardLayout>
  );
}
