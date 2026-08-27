import { useEffect, useState } from "react";
import * as adminApi from "../../api/admin.api";
import { formatDate } from "../../utils/formatDate";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);
const todayValue = () => toDateInputValue(new Date());

// Checkbox list of who's available to assign to a project - shared between
// "Create project" and "Edit project" since both manage the exact same field
// (Project.assignedEmployees). An employee can be on several projects at
// once, so this always shows every non-admin employee - no exclusivity
// filtering. PENDING employees (admin-created accounts that haven't been
// activated yet) are included so admin can line up their project up front;
// they're tagged with a "Pending" badge so it's clear they can't log in yet.
//
// `members` is the canonical selection: [{ userId, startDate, endDate }].
// Checking someone defaults their startDate to today (admin can backdate it
// right there - e.g. someone who's actually been on the project a few days
// already); endDate is optional and purely a historical note.
//
// The "Create project" form stays mounted continuously (unlike Edit, which
// remounts fresh every time it's opened), so its own employee list would
// otherwise go stale if an account is added/deactivated elsewhere while it's
// open - refreshKey lets the parent force a refetch by passing something
// that changes on every project-list reload (e.g. the projects array itself).
export default function ProjectMembersField({ members, onChange, recentHint, refreshKey }) {
  const [employees, setEmployees] = useState(null);
  const [projectsByEmployeeId, setProjectsByEmployeeId] = useState({});
  // Captured once, on mount only - who's already assigned when this field
  // first shows up (e.g. Edit project's existing members). Sorting/grouping
  // against this frozen snapshot instead of the live `members` means
  // checking a new box while editing doesn't yank that row around mid-click.
  const [initialMemberIds] = useState(() => new Set(members.map((m) => m.userId)));

  useEffect(() => {
    adminApi.listUsers().then((data) => {
      setEmployees(
        data.users.filter(
          (u) => (u.status === "ACTIVE" || u.status === "PENDING") && u.userType !== "ADMIN",
        ),
      );
    });

    // What each employee is currently working on (across ALL projects) -
    // shown next to their name so admin can see at a glance who's already
    // busy elsewhere before assigning them to this one too.
    adminApi
      .getProjectAssignmentReport()
      .then((report) => {
        const byEmployeeId = {};
        [...report.assigned, ...report.notAssigned].forEach((row) => {
          if (!row.projectName) return;
          if (!byEmployeeId[row.id]) byEmployeeId[row.id] = [];
          byEmployeeId[row.id].push({ projectName: row.projectName, projectSince: row.projectSince });
        });
        setProjectsByEmployeeId(byEmployeeId);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const memberById = (id) => members.find((m) => m.userId === id);

  const toggle = (id) => {
    if (memberById(id)) {
      onChange(members.filter((m) => m.userId !== id));
    } else {
      onChange([...members, { userId: id, startDate: todayValue(), endDate: "" }]);
    }
  };

  const updateMemberDate = (id, field, value) => {
    onChange(members.map((m) => (m.userId === id ? { ...m, [field]: value } : m)));
  };

  // Already-assigned employees first (so it's immediately obvious who's
  // already working on this project), everyone else below - alphabetical
  // within each group.
  const sortedEmployees = employees
    ? [...employees].sort((a, b) => {
        const aIsMember = initialMemberIds.has(a.id) ? 0 : 1;
        const bIsMember = initialMemberIds.has(b.id) ? 0 : 1;
        if (aIsMember !== bIsMember) return aIsMember - bIsMember;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      })
    : null;

  return (
    <div className="field">
      <label className="field-label">Members {members.length > 0 ? `(${members.length} selected)` : ""}</label>

      {recentHint && recentHint.length > 0 && (
        <p className="helper-text" style={{ marginTop: 0, marginBottom: 8 }}>
          Recently logged time on this project: {recentHint.map((e) => `${e.firstName} ${e.lastName}`).join(", ")}. Check
          them below to formally add them.
        </p>
      )}

      {!employees ? (
        <p className="helper-text">Loading employees…</p>
      ) : employees.length === 0 ? (
        <p className="helper-text">No employees to assign yet.</p>
      ) : (
        <div className="member-list">
          {sortedEmployees.map((employee, index) => {
            const currentProjects = projectsByEmployeeId[employee.id] || [];
            const member = memberById(employee.id);
            const isChecked = Boolean(member);
            // Group-boundary labels, both keyed off the frozen initial
            // snapshot so they don't jump around as checkboxes are toggled.
            const isFirstMember = index === 0 && initialMemberIds.has(employee.id);
            const isFirstNonMember =
              !initialMemberIds.has(employee.id) &&
              (index === 0 || initialMemberIds.has(sortedEmployees[index - 1].id));

            return (
              <div key={employee.id}>
                {isFirstMember && <div className="member-list-group-label">Already on this project</div>}
                {isFirstNonMember && initialMemberIds.size > 0 && (
                  <div className="member-list-group-label">Other employees</div>
                )}
                <div className={`member-row ${isChecked ? "is-checked" : ""}`}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggle(employee.id)} />
                  <span className="member-row-body">
                    <span className="member-row-line">
                      <span className="member-row-name">
                        {employee.firstName} {employee.lastName}
                      </span>
                      {currentProjects.length > 0 ? (
                        <>
                          <span className="member-row-label">Currently working on:</span>
                          <span className="member-project-chips">
                            {currentProjects.map((p, i) => (
                              <span key={i} className="member-project-chip">
                                {p.projectName}
                                <span className="member-project-chip-date">· since {formatDate(p.projectSince)}</span>
                              </span>
                            ))}
                          </span>
                        </>
                      ) : (
                        <span className="member-row-empty">Not currently on a project</span>
                      )}
                    </span>

                    {isChecked && (
                      <span className="member-row-dates">
                        <label className="member-row-date-field">
                          <span>Start date</span>
                          <input
                            type="date"
                            value={member.startDate}
                            onChange={(e) => updateMemberDate(employee.id, "startDate", e.target.value)}
                          />
                        </label>
                        <label className="member-row-date-field">
                          <span>End date (optional)</span>
                          <input
                            type="date"
                            value={member.endDate || ""}
                            onChange={(e) => updateMemberDate(employee.id, "endDate", e.target.value)}
                          />
                        </label>
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
