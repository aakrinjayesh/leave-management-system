import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CalendarDays, Clock, Download, IdCard, RotateCcw, UserPlus, Users, UserCog } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import AddUserModal from "../admin/AddUserModal";
import AssignManagerModal from "../admin/AssignManagerModal";
import { useAuth } from "../../context/AuthContext";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [managingUser, setManagingUser] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [payrollMonth, setPayrollMonth] = useState(currentMonthValue());
  const [isExportingPayroll, setIsExportingPayroll] = useState(false);

  const managerNameById = (id) => {
    const manager = users?.find((u) => u.id === id);
    return manager ? `${manager.firstName} ${manager.lastName}` : "—";
  };

  const loadUsers = () => adminApi.listUsers().then((data) => setUsers(data.users));

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddSuccess = () => {
    setIsAddOpen(false);
    loadUsers();
  };

  const handleManagerSuccess = () => {
    setManagingUser(null);
    loadUsers();
  };

  const handleToggleActive = async (targetUser) => {
    setError("");
    setActioningId(targetUser.id);
    try {
      if (targetUser.status === "INACTIVE") {
        await adminApi.reactivateUser(targetUser.id);
      } else {
        await adminApi.deactivateUser(targetUser.id);
      }
      loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this account."));
    } finally {
      setActioningId(null);
    }
  };

  const employeeCount = users?.filter((u) => u.userType === "EMPLOYEE").length ?? 0;
  const managerTierCount = users?.filter((u) => u.userType === "MANAGER").length ?? 0;

  const handleExportPayroll = async () => {
    setError("");
    setIsExportingPayroll(true);
    try {
      const response = await adminApi.exportPayrollTimesheet(`${payrollMonth}-01`);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, `payroll-timesheet-${payrollMonth}.csv`));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't export payroll timesheet."));
    } finally {
      setIsExportingPayroll(false);
    }
  };

  return (
    <DashboardLayout title="Admin">
      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p>Manage every account in the system and their reporting line.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="field-label" htmlFor="payroll-month">
              Payroll month
            </label>
            <div className="field-input-wrap">
              <input
                id="payroll-month"
                type="month"
                className="field-input"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
              />
            </div>
          </div>
          <Button variant="secondary" onClick={handleExportPayroll} isLoading={isExportingPayroll} className="page-header-btn">
            <Download size={16} />
            Export payroll
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="page-header-btn">
            <UserPlus size={16} />
            Add account
          </Button>
        </div>
      </div>

      {users && (
        <div className="stat-card-grid">
          <StatCard icon={<Users size={20} />} label="Total accounts" value={users.length} />
          <StatCard icon={<Users size={20} />} label="Employees" value={employeeCount} />
          <StatCard icon={<Users size={20} />} label="Manager-tier accounts" value={managerTierCount} />
        </div>
      )}

      <Alert type="error">{error}</Alert>

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
                    <th>Manager</th>
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
                      <td className="table-cell-secondary">{managerNameById(user.managerId)}</td>
                      <td>
                        <StatusBadge status={user.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => setManagingUser(user)}
                          >
                            <UserCog size={14} />
                            Set manager
                          </button>
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => navigate(`/admin/users/${user.id}/timesheet`)}
                          >
                            <Clock size={14} />
                            Timesheet
                          </button>
                          {user.userType !== "ADMIN" && (
                            <button
                              type="button"
                              className="row-action-btn"
                              onClick={() => navigate(`/admin/users/${user.id}/leaves`)}
                            >
                              <CalendarDays size={14} />
                              Leave details
                            </button>
                          )}
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => navigate(`/admin/users/${user.id}/details`)}
                          >
                            <IdCard size={14} />
                            View details
                          </button>
                          {user.id !== currentUser.id && (
                            <button
                              type="button"
                              className={`row-action-btn ${user.status === "INACTIVE" ? "approve" : "reject"}`}
                              disabled={actioningId === user.id}
                              onClick={() => handleToggleActive(user)}
                            >
                              {user.status === "INACTIVE" ? <RotateCcw size={14} /> : <Ban size={14} />}
                              {user.status === "INACTIVE" ? "Reactivate" : "Deactivate"}
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

      {isAddOpen && <AddUserModal onClose={() => setIsAddOpen(false)} onSuccess={handleAddSuccess} />}
      {managingUser && (
        <AssignManagerModal
          user={managingUser}
          allUsers={users}
          onClose={() => setManagingUser(null)}
          onSuccess={handleManagerSuccess}
        />
      )}
    </DashboardLayout>
  );
}
