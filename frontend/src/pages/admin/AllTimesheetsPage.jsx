import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import TextInput from "../../components/common/TextInput";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatHoursMinutes } from "../../utils/formatDuration";
import "../../styles/dashboardShared.css";

// One row per non-admin employee, whether or not they've submitted a
// timesheet. Click a row to open that person's timesheet, where the admin
// approves/rejects each weekly submission.
export default function AllTimesheetsPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminApi
      .getEmployeeTimesheetSummary()
      .then((data) => setEmployees(data.employees))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  const pendingTotal = employees?.reduce((sum, e) => sum + e.pendingCount, 0) ?? 0;
  const noneSubmitted = employees?.every((e) => e.totalSubmissions === 0) ?? false;

  const nameQuery = search.trim().toLowerCase();
  const visibleEmployees = useMemo(() => {
    if (!employees) return [];
    if (!nameQuery) return employees;
    return employees.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(nameQuery));
  }, [employees, nameQuery]);

  return (
    <DashboardLayout title="All timesheets">
      <div className="page-header">
        <div>
          <h1>All timesheets</h1>
          <p>
            Every employee and their weekly timesheet activity. Click a name to review and approve or reject their
            submissions.
          </p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

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
              <p>No employee accounts yet.</p>
            </div>
          ) : (
            <>
              <p className="table-caption">
                {employees.length} employee{employees.length === 1 ? "" : "s"}
                {" · "}
                {pendingTotal > 0 ? (
                  <>
                    <strong>{pendingTotal}</strong> pending submission{pendingTotal === 1 ? "" : "s"}
                  </>
                ) : noneSubmitted ? (
                  "No one has submitted a timesheet yet"
                ) : (
                  "No pending submissions"
                )}
              </p>

              <div className="acct-search">
                <TextInput
                  icon={<Search size={15} />}
                  placeholder="Search by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {nameQuery && (
                  <span className="acct-search-count">
                    {visibleEmployees.length} of {employees.length}
                  </span>
                )}
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Pending</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Hours this month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-cell-secondary" style={{ textAlign: "center" }}>
                          No employees match “{search.trim()}”.
                        </td>
                      </tr>
                    ) : (
                      visibleEmployees.map((employee) => (
                      <tr
                        key={employee.id}
                        className="is-clickable"
                        onClick={() => navigate(`/admin/users/${employee.id}/timesheet`)}
                      >
                        <td className="table-cell-primary">
                          {employee.firstName} {employee.lastName}
                        </td>
                        <td>
                          {employee.pendingCount > 0 ? (
                            <span className="count-pill is-pending">{employee.pendingCount}</span>
                          ) : (
                            <span className="table-cell-secondary">0</span>
                          )}
                        </td>
                        <td className="table-cell-secondary">{employee.approvedCount}</td>
                        <td className="table-cell-secondary">{employee.rejectedCount}</td>
                        <td>{formatHoursMinutes(employee.hoursThisMonth)}</td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
