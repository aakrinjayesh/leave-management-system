import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Clock,
  Eye,
  FileDown,
  IdCard,
  LogOut,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  Upload,
  UserPlus,
  Users,
  UserCog,
  Search,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/common/StatCard";
import Button from "../../components/common/Button";
import TextInput from "../../components/common/TextInput";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import AddUserModal from "../admin/AddUserModal";
import AssignManagerModal from "../admin/AssignManagerModal";
import ExitModal from "../admin/ExitModal";
import AdminAccessModal from "../admin/AdminAccessModal";
import BirthdayCelebrationGate from "../../components/common/BirthdayCelebrationGate";
import { useAuth } from "../../context/AuthContext";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, openBlobInNewTab } from "../../utils/openBlob";
import { formatDate } from "../../utils/formatDate";
import "../../styles/dashboardShared.css";

// Payroll month / export hidden for now - restore alongside the JSX below.
// const currentMonthValue = () => new Date().toISOString().slice(0, 7);

// Account status is shown as a small coloured dot before the name (green =
// active, orange = pending activation, red = inactive/exited) instead of a
// whole column - the accounts table is already very wide.
const STATUS_DOT_CLASS = {
  ACTIVE: "is-active",
  PENDING: "is-pending",
  INACTIVE: "is-inactive",
  REJECTED: "is-inactive",
};

const STATUS_LABEL = {
  ACTIVE: "Active",
  PENDING: "Pending activation",
  INACTIVE: "Inactive",
  REJECTED: "Rejected",
};

export default function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [managingUser, setManagingUser] = useState(null);
  const [exitingUser, setExitingUser] = useState(null);
  const [adminAccessTarget, setAdminAccessTarget] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  // const [payrollMonth, setPayrollMonth] = useState(currentMonthValue());
  // const [isExportingPayroll, setIsExportingPayroll] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [search, setSearch] = useState("");
  const uploadTargetIdRef = useRef(null);
  const documentFileInputRef = useRef(null);

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

  const handleReactivate = async (targetUser) => {
    setError("");
    setActioningId(targetUser.id);
    try {
      await adminApi.reactivateUser(targetUser.id);
      loadUsers();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't reactivate this account."));
    } finally {
      setActioningId(null);
    }
  };

  const handleExitSuccess = () => {
    setExitingUser(null);
    loadUsers();
  };

  const handleAdminAccessSuccess = () => {
    setAdminAccessTarget(null);
    loadUsers();
  };

  // Re-downloads the most recent relieving letter for an already-exited
  // account - the exit-time download only happens once, right after exiting.
  const handleDownloadLatestLetter = async (targetUser) => {
    setError("");
    setActioningId(targetUser.id);
    try {
      const data = await adminApi.listExitRecords(targetUser.id);
      const latest = data.records[0];
      if (!latest) {
        setError("No relieving letter found for this account.");
        return;
      }
      const response = await adminApi.downloadRelievingLetterPdf(latest.id);
      downloadBlobAsFile(response.data, `relieving-letter-${targetUser.firstName}-${targetUser.lastName}.pdf`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download the relieving letter."));
    } finally {
      setActioningId(null);
    }
  };

  const handleUploadClick = (targetUser) => {
    uploadTargetIdRef.current = targetUser.id;
    documentFileInputRef.current.click();
  };

  const handleDocumentFileSelected = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    const userId = uploadTargetIdRef.current;
    if (!file || !userId) return;

    const targetUser = users?.find((u) => u.id === userId);
    const targetName = targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : "this account";

    setError("");
    setSuccess("");
    setUploadingId(userId);
    try {
      await adminApi.uploadUserDocument(userId, "document", file);
      setSuccess(`Document uploaded successfully for ${targetName}.`);
      loadUsers();
    } catch (err) {
      setError(`Upload failed - ${getErrorMessage(err, "couldn't upload this document.")}`);
    } finally {
      setUploadingId(null);
    }
  };

  const handleViewDocument = async (targetUser) => {
    setError("");
    try {
      const blob = await adminApi.downloadUserDocument(targetUser.id, "document");
      openBlobInNewTab(blob);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't open this document."));
    }
  };

  const employeeCount = users?.filter((u) => u.userType === "EMPLOYEE").length ?? 0;
  const managerTierCount = users?.filter((u) => u.userType === "MANAGER").length ?? 0;

  // Client-side name filter for the accounts table - clearing it shows everyone again.
  const nameQuery = search.trim().toLowerCase();
  const visibleUsers = nameQuery
    ? (users ?? []).filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(nameQuery))
    : (users ?? []);

  // Payroll export hidden for now - restore alongside the JSX below.
  // const handleExportPayroll = async () => {
  //   setError("");
  //   setIsExportingPayroll(true);
  //   try {
  //     const response = await adminApi.exportPayrollTimesheet(`${payrollMonth}-01`);
  //     downloadBlobAsFile(response.data, getFilenameFromResponse(response, `payroll-timesheet-${payrollMonth}.csv`));
  //   } catch (err) {
  //     setError(getErrorMessage(err, "Couldn't export payroll timesheet."));
  //   } finally {
  //     setIsExportingPayroll(false);
  //   }
  // };

  return (
    <DashboardLayout title="Manage Accounts">
      <BirthdayCelebrationGate />
      <div className="page-header">
        <div>
          <h1>Accounts</h1>
          <p>Manage every account in the system and their reporting line.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Payroll month + Export payroll hidden for now - will be brought back later
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
          */}
          <Button onClick={() => setIsAddOpen(true)} className="page-header-btn btn-sm">
            <UserPlus size={16} />
            Add account
          </Button>
        </div>
      </div>

      {users && (
        <div className="stat-card-grid stats-compact">
          <StatCard icon={<Users size={18} />} label="Total accounts" value={users.length} />
          <StatCard icon={<Users size={18} />} label="Employees" value={employeeCount} />
          <StatCard icon={<Users size={18} />} label="Manager-tier accounts" value={managerTierCount} />
        </div>
      )}

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="card">
        <div className="card-section">
          {!users ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : (
            <>
              <div className="acct-search">
                <TextInput
                  icon={<Search size={15} />}
                  placeholder="Search by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {nameQuery && (
                  <span className="acct-search-count">
                    {visibleUsers.length} of {users.length}
                  </span>
                )}
              </div>

              <div className="data-table-wrap">
                <table className="data-table sticky-first-two">
                  <thead>
                    <tr>
                      <th className="acct-code-col">Employee code</th>
                      <th>Name</th>
                      {/* Email column hidden for now - will be brought back later */}
                      <th>Manager</th>
                      <th></th>
                      <th>Exit date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ textAlign: "center", padding: "28px 0", color: "var(--text-secondary)" }}
                        >
                          No accounts match &ldquo;{search.trim()}&rdquo;.
                        </td>
                      </tr>
                    ) : (
                      visibleUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="acct-code-col table-cell-secondary">{user.employeeCode || "—"}</td>
                          <td className="table-cell-primary">
                            <span
                              className={`status-dot ${STATUS_DOT_CLASS[user.status] || ""}`}
                              title={STATUS_LABEL[user.status] || user.status}
                            />
                            {user.firstName} {user.lastName}
                          </td>
                          {/* Email column hidden for now - will be brought back later */}
                          <td className="table-cell-secondary">{managerNameById(user.managerId)}</td>
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
                          {user.id !== currentUser.id &&
                            (user.userType === "ADMIN" ? (
                              <button
                                type="button"
                                className="row-action-btn reject"
                                onClick={() => setAdminAccessTarget({ user, grant: false })}
                              >
                                <ShieldOff size={14} />
                                Remove admin access
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="row-action-btn"
                                onClick={() => setAdminAccessTarget({ user, grant: true })}
                              >
                                <ShieldCheck size={14} />
                                Make admin
                              </button>
                            ))}
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
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={uploadingId === user.id}
                            onClick={() => handleUploadClick(user)}
                          >
                            <Upload size={14} />
                            {user.hasDocument ? "Replace" : "Upload"}
                          </button>
                          {user.hasDocument && (
                            <button type="button" className="row-action-btn" onClick={() => handleViewDocument(user)}>
                              <Eye size={14} />
                              View
                            </button>
                          )}
                          {user.status === "INACTIVE" && (
                            <button
                              type="button"
                              className="row-action-btn"
                              disabled={actioningId === user.id}
                              onClick={() => handleDownloadLatestLetter(user)}
                            >
                              <FileDown size={14} />
                              Download letter
                            </button>
                          )}
                          {user.id !== currentUser.id &&
                            (user.status === "INACTIVE" ? (
                              <button
                                type="button"
                                className="row-action-btn approve"
                                disabled={actioningId === user.id}
                                onClick={() => handleReactivate(user)}
                              >
                                <RotateCcw size={14} />
                                Reactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="row-action-btn reject"
                                disabled={actioningId === user.id}
                                onClick={() => setExitingUser(user)}
                              >
                                <LogOut size={14} />
                                Exit
                              </button>
                            ))}
                        </div>
                      </td>
                      <td className="table-cell-secondary">
                        {user.exitDate ? formatDate(user.exitDate) : "—"}
                      </td>
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

      {isAddOpen && <AddUserModal onClose={() => setIsAddOpen(false)} onSuccess={handleAddSuccess} />}
      {managingUser && (
        <AssignManagerModal
          user={managingUser}
          allUsers={users}
          onClose={() => setManagingUser(null)}
          onSuccess={handleManagerSuccess}
        />
      )}
      {exitingUser && (
        <ExitModal user={exitingUser} onClose={() => setExitingUser(null)} onSuccess={handleExitSuccess} />
      )}
      {adminAccessTarget && (
        <AdminAccessModal
          user={adminAccessTarget.user}
          grant={adminAccessTarget.grant}
          onClose={() => setAdminAccessTarget(null)}
          onSuccess={handleAdminAccessSuccess}
        />
      )}
      <input
        ref={documentFileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={handleDocumentFileSelected}
      />
    </DashboardLayout>
  );
}
