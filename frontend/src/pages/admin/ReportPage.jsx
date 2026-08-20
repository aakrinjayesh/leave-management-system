import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Users,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import FormSelect from "../../components/common/FormSelect";
import TextInput from "../../components/common/TextInput";
import TimeOfDayField from "../../components/common/TimeOfDayField";
import Spinner from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import EditProjectModal from "./EditProjectModal";
import ProjectHistoryModal from "./ProjectHistoryModal";
import ProjectMembersField from "./ProjectMembersField";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import { PROJECT_TYPE_OPTIONS, TIMEZONE_OPTIONS, formatProjectType, formatWorkingHours } from "../../utils/projectOptions";
import "../../styles/dashboardShared.css";

// Trims to 1 decimal only when it's not a whole number - "5" instead of
// "5.0", but "4.5" stays as-is.
const formatNum = (value) => {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

function EmployeeListCard({
  title,
  employees,
  weekSubmissionsByUserId,
  workloadByUserId,
  downloadingId,
  onDownloadTimesheet,
  onViewHistory,
}) {
  const navigate = useNavigate();
  const showTimesheetColumn = Boolean(weekSubmissionsByUserId);
  const showWorkloadColumns = Boolean(workloadByUserId);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // Scoped to just this card's own list (e.g. only the 10 people on Internal
  // Project), not every employee company-wide - a quick jump-to-person
  // picker for when that list itself is too long to scroll through.
  const visibleEmployees = selectedEmployeeId
    ? employees.filter((employee) => String(employee.id) === selectedEmployeeId)
    : employees;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <div className="section-flex-row">
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            {title} {employees.length ? `(${employees.length})` : ""}
          </span>
          {employees.length > 0 && (
            <div className="field" style={{ maxWidth: 280, marginBottom: 0 }}>
              <FormSelect value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                <option value="">All {employees.length} members</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.firstName} {employee.lastName} ({employee.email})
                  </option>
                ))}
              </FormSelect>
            </div>
          )}
        </div>

        {visibleEmployees.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <ListChecks size={22} />
            </span>
            <p>Nobody here.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Project</th>
                  <th>Since</th>
                  {showTimesheetColumn && <th>Timesheet</th>}
                  {showWorkloadColumns && (
                    <>
                      <th>Total Working Days</th>
                      <th>Leaves &amp; Holidays</th>
                      <th>Billable Days</th>
                      <th>Total Working Hrs</th>
                      <th>Total Worked Hrs</th>
                      <th>Billable Hrs</th>
                    </>
                  )}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => {
                  const submission = weekSubmissionsByUserId?.[employee.id];
                  const workload = workloadByUserId?.[employee.id];
                  return (
                    <tr
                      key={employee.id}
                      className="is-clickable"
                      onClick={() => navigate(`/admin/users/${employee.id}/timesheet`)}
                    >
                      <td className="table-cell-secondary">{employee.employeeCode || "—"}</td>
                      <td className="table-cell-primary">
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td className="table-cell-secondary">{employee.email}</td>
                      <td className="table-cell-secondary">{employee.projectName || "—"}</td>
                      <td className="table-cell-secondary">
                        {employee.projectSince ? formatDate(employee.projectSince) : "—"}
                      </td>
                      {showTimesheetColumn && (
                        <td onClick={(e) => e.stopPropagation()}>
                          {submission?.attachmentStoredName ? (
                            <button
                              type="button"
                              className="link-btn"
                              disabled={downloadingId === submission.id}
                              onClick={() => onDownloadTimesheet(submission)}
                            >
                              <Download size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                              {downloadingId === submission.id ? "Downloading…" : "Download"}
                            </button>
                          ) : (
                            <span className="table-cell-secondary">Not submitted</span>
                          )}
                        </td>
                      )}
                      {showWorkloadColumns && (
                        <>
                          <td className="table-cell-secondary">{formatNum(workload?.totalWorkingDays)}</td>
                          <td className="table-cell-secondary">{formatNum(workload?.leavesHolidaysDays)}</td>
                          <td className="table-cell-secondary">{formatNum(workload?.billableDays)}</td>
                          <td className="table-cell-secondary">{formatNum(workload?.totalWorkingHrs)}h</td>
                          <td className="table-cell-secondary">{formatNum(workload?.totalWorkedHrs)}h</td>
                          <td className="table-cell-secondary">{formatNum(workload?.billableHrs)}h</td>
                        </>
                      )}
                      <td onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="row-action-btn" onClick={() => onViewHistory(employee)}>
                          <Clock size={14} />
                          View history
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_NEW_PROJECT = {
  name: "",
  projectType: "",
  timezone: "",
  workStartTime: "",
  workEndTime: "",
};

function ManageProjectsCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [newProject, setNewProject] = useState(DEFAULT_NEW_PROJECT);
  const [newProjectMemberIds, setNewProjectMemberIds] = useState([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [actioningId, setActioningId] = useState(null);

  const loadProjects = () =>
    adminApi
      .listProjects()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadProjects();
  }, []);

  const handleNewProjectChange = (field) => (e) =>
    setNewProject((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;
    if (!newProject.projectType) {
      setError("Please select a project type.");
      return;
    }
    if (!newProject.timezone.trim()) {
      setError("Please enter a timezone.");
      return;
    }
    if (!newProject.workStartTime || !newProject.workEndTime) {
      setError("Please set both a start and end working hour.");
      return;
    }
    if (newProject.workEndTime <= newProject.workStartTime) {
      setError("End time must be after the start time.");
      return;
    }

    setError("");
    setIsAdding(true);
    try {
      await adminApi.createProject({ ...newProject, name: newProject.name.trim(), employeeIds: newProjectMemberIds });
      setNewProject(DEFAULT_NEW_PROJECT);
      setNewProjectMemberIds([]);
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add this project."));
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditSuccess = () => {
    setEditingProject(null);
    loadProjects();
  };

  const handleToggleActive = async (project) => {
    setError("");
    setActioningId(project.id);
    try {
      if (project.isActive) {
        await adminApi.deactivateProject(project.id);
      } else {
        await adminApi.reactivateProject(project.id);
      }
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this project."));
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <button
          type="button"
          className="section-flex-row"
          style={{
            width: "100%",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            justifyContent: "flex-start",
            gap: 10,
          }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            Create project {projects ? `(${projects.length})` : ""}
          </span>
        </button>

        {isExpanded && (
          <>
            <Alert type="error">{error}</Alert>

            <form onSubmit={handleAdd} style={{ marginTop: 16, marginBottom: 16 }}>
              <div className="form-two-col">
                <TextInput
                  label="Project name"
                  placeholder="New project name"
                  value={newProject.name}
                  onChange={handleNewProjectChange("name")}
                />
                <FormSelect label="Project type" value={newProject.projectType} onChange={handleNewProjectChange("projectType")}>
                  <option value="" hidden></option>
                  {PROJECT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </FormSelect>
              </div>
              <div className="form-two-col">
                <TextInput
                  label="Timezone"
                  list="timezone-suggestions"
                  placeholder="e.g. India (IST, UTC+5:30)"
                  value={newProject.timezone}
                  onChange={handleNewProjectChange("timezone")}
                />
                <div className="form-two-col" style={{ margin: 0 }}>
                  <TimeOfDayField
                    label="Hours start"
                    value={newProject.workStartTime}
                    onChange={(value) => setNewProject((prev) => ({ ...prev, workStartTime: value }))}
                  />
                  <TimeOfDayField
                    label="Hours end"
                    value={newProject.workEndTime}
                    onChange={(value) => setNewProject((prev) => ({ ...prev, workEndTime: value }))}
                  />
                </div>
              </div>
              <datalist id="timezone-suggestions">
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.label} />
                ))}
              </datalist>

              <ProjectMembersField
                selectedIds={newProjectMemberIds}
                onChange={setNewProjectMemberIds}
                refreshKey={projects}
              />

              <div style={{ marginTop: 16 }}>
                <Button type="submit" isLoading={isAdding}>
                  <Plus size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                  Add project
                </Button>
              </div>
            </form>
          </>
        )}

        {isExpanded && (!projects ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <Spinner size={24} />
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <ListChecks size={22} />
            </span>
            <p>No projects added yet.</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project name</th>
                  <th>Type</th>
                  <th>Working hours</th>
                  <th>Members</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="table-cell-primary">{project.name}</td>
                    <td className="table-cell-secondary">{formatProjectType(project.projectType)}</td>
                    <td className="table-cell-secondary">{formatWorkingHours(project)}</td>
                    <td className="table-cell-secondary">{project.assignedEmployees?.length ?? 0}</td>
                    <td>
                      <StatusBadge status={project.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="row-action-btn" onClick={() => setEditingProject(project)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`row-action-btn ${project.isActive ? "reject" : "approve"}`}
                          disabled={actioningId === project.id}
                          onClick={() => handleToggleActive(project)}
                        >
                          {project.isActive ? <Ban size={14} /> : <RotateCcw size={14} />}
                          {project.isActive ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default function ReportPage() {
  const [report, setReport] = useState(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [weekDate, setWeekDate] = useState("");
  const [weekData, setWeekData] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");
  const [historyEmployee, setHistoryEmployee] = useState(null);

  useEffect(() => {
    adminApi.getProjectAssignmentReport().then(setReport);
  }, []);

  useEffect(() => {
    if (!weekDate) return;
    adminApi.getWeekTimesheetSubmissions(weekDate).then(setWeekData);
  }, [weekDate]);

  // Ignore any previously-fetched week once the date is cleared, rather than
  // resetting weekData itself from the effect above.
  const effectiveWeekData = weekDate ? weekData : null;

  // A-Z list of every project actually in use across both lists, so the
  // filter only ever offers projects that would return a result.
  const projectNames = report
    ? [...new Set([...report.assigned, ...report.notAssigned].map((e) => e.projectName).filter(Boolean))].sort()
    : [];

  const applyFilters = (employees) => {
    const byProject = projectFilter
      ? employees.filter((employee) => employee.projectName === projectFilter)
      : employees;

    const query = searchQuery.trim().toLowerCase();
    if (!query) return byProject;

    return byProject.filter((employee) => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        (employee.employeeCode || "").toLowerCase().includes(query) ||
        (employee.email || "").toLowerCase().includes(query)
      );
    });
  };

  const weekSubmissionsByUserId = effectiveWeekData
    ? Object.fromEntries(effectiveWeekData.submissions.map((submission) => [submission.userId, submission]))
    : null;

  const workloadByUserId = effectiveWeekData?.workload ?? null;

  const handleDownloadTimesheet = async (submission) => {
    setError("");
    setDownloadingId(submission.id);
    try {
      const response = await adminApi.downloadTimesheetSubmissionAttachment(submission.id);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, submission.attachmentOriginalName));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this attachment."));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <DashboardLayout title="Report">
      <div className="page-header">
        <div>
          <h1>Report</h1>
          <p>Which employees are on a client project vs an internal project.</p>
        </div>
      </div>

      <ManageProjectsCard />

      <Alert type="error">{error}</Alert>

      {!report ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div className="stat-card-grid">
            <StatCard icon={<Users size={20} />} label="Total employees" value={report.totalEmployees} />
            <StatCard icon={<CheckCircle2 size={20} />} label="Employees on Client Projects" value={report.assignedCount} />
            <StatCard icon={<XCircle size={20} />} label="Employees on Internal Projects" value={report.notAssignedCount} />
          </div>

          <div className="section-flex-row" style={{ alignItems: "flex-start" }}>
            <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
              <label className="field-label">Filter by Project</label>
              <FormSelect value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">All projects</option>
                {projectNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
              <TextInput
                label="Search employee"
                icon={<Search size={16} />}
                placeholder="Name, employee ID or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
              <TextInput
                label="Week of"
                type="date"
                value={weekDate}
                onChange={(e) => setWeekDate(e.target.value)}
              />
              {effectiveWeekData && (
                <p className="helper-text" style={{ marginTop: 0 }}>
                  {formatDateRange(effectiveWeekData.weekStartDate, effectiveWeekData.weekEndDate)}
                </p>
              )}
            </div>
          </div>

          <EmployeeListCard
            title="Client Project"
            employees={applyFilters(report.assigned)}
            weekSubmissionsByUserId={weekSubmissionsByUserId}
            workloadByUserId={workloadByUserId}
            downloadingId={downloadingId}
            onDownloadTimesheet={handleDownloadTimesheet}
            onViewHistory={setHistoryEmployee}
          />
          <EmployeeListCard
            title="Internal Project"
            employees={applyFilters(report.notAssigned)}
            weekSubmissionsByUserId={weekSubmissionsByUserId}
            workloadByUserId={workloadByUserId}
            downloadingId={downloadingId}
            onDownloadTimesheet={handleDownloadTimesheet}
            onViewHistory={setHistoryEmployee}
          />
        </>
      )}

      {historyEmployee && (
        <ProjectHistoryModal employee={historyEmployee} onClose={() => setHistoryEmployee(null)} />
      )}
    </DashboardLayout>
  );
}
