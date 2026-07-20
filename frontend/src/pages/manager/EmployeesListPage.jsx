import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import * as managerLeaveApi from "../../api/managerLeave.api";
import "../../styles/dashboardShared.css";

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(null);

  useEffect(() => {
    managerLeaveApi.getEmployees().then((data) => setEmployees(data.employees));
  }, []);

  return (
    <DashboardLayout title="Employees">
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p>Everyone who reports to you, with their usage and balance.</p>
        </div>
      </div>

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
                    <th>Days used</th>
                    <th>Days remaining</th>
                    <th>Pending requests</th>
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
                      <td>{employee.totalUsed}</td>
                      <td>{employee.totalRemaining}</td>
                      <td>{employee.pendingRequestsCount}</td>
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
