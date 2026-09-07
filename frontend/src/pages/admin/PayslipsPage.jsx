import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Spinner from "../../components/common/Spinner";
import StatusBadge from "../../components/common/StatusBadge";
import TextInput from "../../components/common/TextInput";
import * as adminApi from "../../api/admin.api";
import "../../styles/dashboardShared.css";

const EMPLOYMENT_TYPE_LABELS = { EMPLOYEE: "Employee", INTERN: "Intern", CONTRACT: "Hire to contract" };

const TYPE_FILTERS = [
  { value: "", label: "All" },
  { value: "EMPLOYEE", label: "Employees" },
  { value: "INTERN", label: "Interns" },
  { value: "CONTRACT", label: "Hire to contract" },
];

export default function PayslipsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const loadUsers = () =>
    adminApi.listUsers().then((data) => setUsers(data.users.filter((u) => u.userType !== "ADMIN")));

  useEffect(() => {
    loadUsers();
  }, []);

  const query = search.trim().toLowerCase();
  const visibleUsers = users
    ? users
        .filter((u) => !typeFilter || (u.employmentType || "EMPLOYEE") === typeFilter)
        .filter(
          (u) =>
            !query ||
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
            (u.email || "").toLowerCase().includes(query) ||
            (u.employeeCode || "").toLowerCase().includes(query),
        )
    : null;

  return (
    <DashboardLayout title="Payslips">
      <div className="page-header">
        <div>
          <h1>Payslips</h1>
          <p>Generate and download a monthly payslip for any employee.</p>
        </div>
      </div>

      <div
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px", marginBottom: 16 }}
      >
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter-tab ${typeFilter === f.value ? "active" : ""}`}
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", flex: "1 1 240px", maxWidth: 320 }}>
          <TextInput
            icon={<Search size={15} />}
            placeholder="Search by name, email or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          {!visibleUsers ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="empty-state">
              <p>{query ? "No accounts match your search." : "No accounts of this type."}</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Salary/CTC</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="table-cell-secondary" style={{ whiteSpace: "nowrap" }}>
                        {user.employeeCode || "—"}
                      </td>
                      <td className="table-cell-primary">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="table-cell-secondary">{user.email}</td>
                      <td className="table-cell-secondary">
                        {EMPLOYMENT_TYPE_LABELS[user.employmentType] || "Employee"}
                      </td>
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
