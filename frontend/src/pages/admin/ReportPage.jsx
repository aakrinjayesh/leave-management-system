import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Users,
  XCircle,
} from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/common/StatCard";
import StatusBadge from "../../components/common/StatusBadge";
import FormSelect from "../../components/common/FormSelect";
import TextInput from "../../components/common/TextInput";
import Spinner from "../../components/common/Spinner";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDateRange } from "../../utils/formatDate";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

function EmployeeListCard({ title, employees, weekSubmissionsByUserId, downloadingId, onDownloadTimesheet }) {
  const navigate = useNavigate();
  const showTimesheetColumn = Boolean(weekSubmissionsByUserId);

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">{title}</span>

        {employees.length === 0 ? (
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
                  {showTimesheetColumn && <th>Timesheet</th>}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const submission = weekSubmissionsByUserId?.[employee.id];
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

function ManageProjectsCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [actioningId, setActioningId] = useState(null);

  const loadProjects = () =>
    adminApi
      .listProjects()
      .then((res) => setProjects(res.projects))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadProjects();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setError("");
    setIsAdding(true);
    try {
      await adminApi.createProject({ name: newName.trim() });
      setNewName("");
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add this project."));
    } finally {
      setIsAdding(false);
    }
  };

  const startRename = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
  };

  const handleRename = async (project) => {
    if (!editingName.trim()) return;

    setError("");
    setActioningId(project.id);
    try {
      await adminApi.renameProject(project.id, { name: editingName.trim() });
      setEditingId(null);
      await loadProjects();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't rename this project."));
    } finally {
      setActioningId(null);
    }
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
          style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            Manage projects {projects ? `(${projects.length})` : ""}
          </span>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isExpanded && (
          <>
            <Alert type="error">{error}</Alert>

            <form onSubmit={handleAdd} className="section-flex-row" style={{ marginTop: 16, marginBottom: 16 }}>
              <input
                type="text"
                className="field-input"
                placeholder="New project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button type="submit" isLoading={isAdding}>
                <Plus size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                Add project
              </Button>
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
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id}>
                    <td className="table-cell-primary">
                      {editingId === project.id ? (
                        <input
                          type="text"
                          className="field-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                        />
                      ) : (
                        project.name
                      )}
                    </td>
                    <td>
                      <StatusBadge status={project.isActive ? "ACTIVE" : "INACTIVE"} />
                    </td>
                    <td>
                      <div className="row-actions">
                        {editingId === project.id ? (
                          <>
                            <button
                              type="button"
                              className="row-action-btn approve"
                              disabled={actioningId === project.id}
                              onClick={() => handleRename(project)}
                            >
                              Save
                            </button>
                            <button type="button" className="row-action-btn" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button type="button" className="row-action-btn" onClick={() => startRename(project)}>
                            <Pencil size={14} />
                            Rename
                          </button>
                        )}
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
    </div>
  );
}

export default function ReportPage() {
  const [report, setReport] = useState(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [weekDate, setWeekDate] = useState("");
  const [weekData, setWeekData] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState("");

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

  const applyProjectFilter = (employees) =>
    projectFilter ? employees.filter((employee) => employee.projectName === projectFilter) : employees;

  const weekSubmissionsByUserId = effectiveWeekData
    ? Object.fromEntries(effectiveWeekData.submissions.map((submission) => [submission.userId, submission]))
    : null;

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
            <StatCard icon={<CheckCircle2 size={20} />} label="Client Project" value={report.assignedCount} />
            <StatCard icon={<XCircle size={20} />} label="Internal Project" value={report.notAssignedCount} />
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
            employees={applyProjectFilter(report.assigned)}
            weekSubmissionsByUserId={weekSubmissionsByUserId}
            downloadingId={downloadingId}
            onDownloadTimesheet={handleDownloadTimesheet}
          />
          <EmployeeListCard
            title="Internal Project"
            employees={applyProjectFilter(report.notAssigned)}
            weekSubmissionsByUserId={weekSubmissionsByUserId}
            downloadingId={downloadingId}
            onDownloadTimesheet={handleDownloadTimesheet}
          />
        </>
      )}
    </DashboardLayout>
  );
}
