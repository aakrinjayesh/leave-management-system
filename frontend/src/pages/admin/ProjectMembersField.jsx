import { useEffect, useState } from "react";
import * as adminApi from "../../api/admin.api";

// Checkbox list of who's available to assign to a project - shared between
// "Create project" and "Edit project" since both manage the exact same field
// (Project.assignedEmployees). An employee can be on several projects at
// once, so this always shows every active, non-admin employee - no
// exclusivity filtering.
//
// The "Create project" form stays mounted continuously (unlike Edit, which
// remounts fresh every time it's opened), so its own employee list would
// otherwise go stale if an account is added/deactivated elsewhere while it's
// open - refreshKey lets the parent force a refetch by passing something
// that changes on every project-list reload (e.g. the projects array itself).
export default function ProjectMembersField({ selectedIds, onChange, recentHint, refreshKey }) {
  const [employees, setEmployees] = useState(null);

  useEffect(() => {
    adminApi.listUsers().then((data) => {
      setEmployees(data.users.filter((u) => u.status === "ACTIVE" && u.userType !== "ADMIN"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const toggle = (id) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]);
  };

  return (
    <div className="field">
      <label className="field-label">
        Members {selectedIds.length > 0 ? `(${selectedIds.length} selected)` : ""}
      </label>

      {recentHint && recentHint.length > 0 && (
        <p className="helper-text" style={{ marginTop: 0, marginBottom: 8 }}>
          Recently logged time on this project: {recentHint.map((e) => `${e.firstName} ${e.lastName}`).join(", ")}. Check
          them below to formally add them.
        </p>
      )}

      {!employees ? (
        <p className="helper-text">Loading employees…</p>
      ) : employees.length === 0 ? (
        <p className="helper-text">No active employees to assign yet.</p>
      ) : (
        <div
          style={{
            maxHeight: 220,
            overflowY: "auto",
            border: "1px solid var(--border-color, #e5e7eb)",
            borderRadius: 8,
            padding: "8px 12px",
          }}
        >
          {employees.map((employee) => (
            <label key={employee.id} className="checkbox-row">
              <input
                type="checkbox"
                checked={selectedIds.includes(employee.id)}
                onChange={() => toggle(employee.id)}
              />
              {employee.firstName} {employee.lastName} — {employee.email}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
