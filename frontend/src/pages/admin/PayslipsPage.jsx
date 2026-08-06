import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import StatusBadge from "../../components/common/StatusBadge";
import * as adminApi from "../../api/admin.api";
import "../../styles/dashboardShared.css";

export default function PayslipsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);

  const loadUsers = () =>
    adminApi.listUsers().then((data) => setUsers(data.users.filter((u) => u.userType !== "ADMIN")));

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <DashboardLayout title="Admin">
      <div className="page-header">
        <div>
          <h1>Payslips</h1>
          <p>Generate and download a monthly payslip for any employee.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          {!users ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Salary/CTC</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell-primary">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="table-cell-secondary">{user.email}</td>
                      <td className="table-cell-secondary">{user.userType}</td>
                      <td className="table-cell-secondary">
                        {user.salaryCtc ? `₹${user.salaryCtc.toLocaleString("en-IN")}` : "Not set"}
                      </td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => navigate(`/admin/users/${user.id}/payslips`)}
                          >
                            <FileText size={14} />
                            Payslips
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
