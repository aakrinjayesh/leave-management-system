import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileClock } from "lucide-react";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { formatDate } from "../../utils/formatDate";

const fullName = (e) => `${e.firstName} ${e.lastName}`;
const byName = (a, b) => fullName(a).localeCompare(fullName(b));

// Read-only "Employee timesheets" tab of the Manage-members modal. Lists this
// project's people first, everyone else below, and shows how many projects
// each is on. Clicking a row opens that employee's full admin timesheet page
// (/admin/users/:id/timesheet) - the data there already exists, this is just
// a shortcut into it scoped to one project's team.
export default function ProjectEmployeeTimesheets({ project }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState(null);
  const [projectsByEmployeeId, setProjectsByEmployeeId] = useState({});

  useEffect(() => {
    adminApi.listUsers().then((data) => {
      setEmployees(
        data.users.filter(
          (u) => (u.status === "ACTIVE" || u.status === "PENDING") && u.userType !== "ADMIN",
        ),
      );
    });

    adminApi
      .getProjectAssignmentReport()
      .then((report) => {
        const byId = {};
        [...report.assigned, ...report.notAssigned].forEach((row) => {
          if (!row.projectName) return;
          if (!byId[row.id]) byId[row.id] = [];
          byId[row.id].push({ projectName: row.projectName, projectSince: row.projectSince });
        });
        setProjectsByEmployeeId(byId);
      })
      .catch(() => {});
  }, []);

  const memberIds = new Set((project.assignedEmployees || []).map((e) => e.id));
  const onProject = employees ? employees.filter((e) => memberIds.has(e.id)).sort(byName) : [];
  const others = employees ? employees.filter((e) => !memberIds.has(e.id)).sort(byName) : [];

  const renderRow = (employee) => {
    const projs = projectsByEmployeeId[employee.id] || [];
    return (
      <div
        key={employee.id}
        className="member-row is-clickable-row"
        onClick={() => navigate(`/admin/users/${employee.id}/timesheet`)}
      >
        <span className="member-row-body">
          <span className="member-row-line">
            <span className="member-row-name">{fullName(employee)}</span>
            <span className="row-action-btn">
              <FileClock size={14} />
              View timesheet
            </span>
          </span>
          <span className="member-row-sub">
            {projs.length > 0 ? (
              <>
                <span className="member-row-label">On {projs.length} project{projs.length > 1 ? "s" : ""}:</span>{" "}
                {projs.map((p) => `${p.projectName} (since ${formatDate(p.projectSince)})`).join(", ")}
              </>
            ) : (
              "Not on any project"
            )}
          </span>
        </span>
      </div>
    );
  };

  if (!employees) {
    return (
      <div className="member-list" style={{ display: "flex", justifyContent: "center", padding: 24 }}>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="member-list">
      <div className="member-list-group-label">On this project ({onProject.length})</div>
      {onProject.length > 0 ? (
        onProject.map(renderRow)
      ) : (
        <p className="member-list-note">Nobody is on this project yet.</p>
      )}

      <div className="member-list-group-label">Other employees ({others.length})</div>
      {others.length > 0 ? (
        others.map(renderRow)
      ) : (
        <p className="member-list-note">Everyone is on this project.</p>
      )}
    </div>
  );
}
