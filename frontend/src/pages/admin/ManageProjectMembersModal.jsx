import { useEffect, useState } from "react";
import { Ban, Pencil, RotateCcw } from "lucide-react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import ProjectMembersField from "./ProjectMembersField";
import ProjectEmployeeTimesheets from "./ProjectEmployeeTimesheets";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";
import {
  formatProjectType,
  formatProjectTimezone,
  formatSubmissionFrequency,
  formatWorkingHours,
} from "../../utils/projectOptions";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const toMembers = (project) =>
  (project.assignedEmployees || []).map((e) => ({
    userId: e.id,
    startDate: toDateInputValue(e.assignedAt),
    endDate: e.endDate ? toDateInputValue(e.endDate) : "",
  }));

// Standalone "who's on this project" editor - opened by clicking a project
// row on the Report page. Handles the member list (check to add / uncheck to
// remove, plus per-member start/end dates); Edit and Deactivate/Reactivate in
// the header defer to the parent so they behave like the project table's own
// buttons.
export default function ManageProjectMembersModal({
  project,
  onClose,
  onSuccess,
  onEdit,
  onToggleActive,
  isToggling = false,
}) {
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState(toMembers(project));
  const [recentMembers, setRecentMembers] = useState([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    adminApi
      .getProjectRecentMembers(project.id)
      .then((data) => {
        const alreadyMemberIds = new Set(members.map((m) => m.userId));
        setRecentMembers(data.members.filter((m) => !alreadyMemberIds.has(m.id)));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    for (const member of members) {
      if (member.endDate && member.endDate < member.startDate) {
        setError("A member's end date can't be before their own start date.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await adminApi.updateProjectMembers(
        project.id,
        members.map((m) => ({ ...m, endDate: m.endDate || null })),
      );
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the member list. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClient = project.projectType === "ASSIGNED";
  const memberCount = project.assignedEmployees?.length ?? 0;

  const headerActions = (
    <>
      <button type="button" className="row-action-btn" onClick={onEdit}>
        <Pencil size={14} />
        Edit
      </button>
      <button
        type="button"
        className={`row-action-btn ${project.isActive ? "reject" : "approve"}`}
        disabled={isToggling}
        onClick={onToggleActive}
      >
        {project.isActive ? <Ban size={14} /> : <RotateCcw size={14} />}
        {project.isActive ? "Deactivate" : "Reactivate"}
      </button>
    </>
  );

  return (
    <Modal title="Manage project members" onClose={onClose} full headerActions={headerActions}>
      <div className="pm-modal-body">
        <Alert type="error">{error}</Alert>

        <div className="pm-detail">
          <div className="pm-detail-head">
            <h3 className="pm-detail-name">{project.name}</h3>
            <div className="pm-detail-badges">
              <span className={`pm-badge ${isClient ? "is-client" : "is-internal"}`}>
                {formatProjectType(project.projectType)}
              </span>
              <span className={`pm-badge ${project.isActive ? "is-active" : "is-inactive"}`}>
                {project.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <dl className="pm-detail-grid">
            <div>
              <dt>Working hours</dt>
              <dd>{formatWorkingHours(project)}</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>{formatProjectTimezone(project.timezone)}</dd>
            </div>
            <div>
              <dt>Timesheets</dt>
              <dd>{formatSubmissionFrequency(project.submissionFrequency)}</dd>
            </div>
            <div>
              <dt>Start date</dt>
              <dd>{formatDate(project.startDate)}</dd>
            </div>
            <div>
              <dt>End date</dt>
              <dd>{project.endDate ? formatDate(project.endDate) : "Ongoing"}</dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{memberCount}</dd>
            </div>
          </dl>
        </div>

        <div className="filter-tabs" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`filter-tab ${tab === "members" ? "active" : ""}`}
            onClick={() => setTab("members")}
          >
            Members
          </button>
          <button
            type="button"
            className={`filter-tab ${tab === "timesheets" ? "active" : ""}`}
            onClick={() => setTab("timesheets")}
          >
            Employee timesheets
          </button>
        </div>

        {tab === "members" ? (
          <>
            <p className="helper-text" style={{ marginTop: 0 }}>
              Check an employee to add them, uncheck to remove them. Members pick up this
              project's type, timezone, working hours and submission frequency automatically.
              Use <strong>Edit</strong> above to change any of those project details.
            </p>

            <form onSubmit={handleSubmit} noValidate className="pm-modal-form">
              <div className="pm-modal-list">
                <ProjectMembersField
                  members={members}
                  onChange={setMembers}
                  recentHint={recentMembers}
                />
              </div>

              <div className="modal-actions pm-modal-footer">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Save members
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="pm-modal-form">
            <p className="helper-text" style={{ marginTop: 0 }}>
              Click an employee to open their full timesheet. People on this project are listed
              first, everyone else below.
            </p>

            <div className="pm-modal-list">
              <ProjectEmployeeTimesheets project={project} />
            </div>

            <div className="modal-actions pm-modal-footer">
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
