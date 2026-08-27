import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import ProjectMembersField from "./ProjectMembersField";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const toMembers = (project) =>
  (project.assignedEmployees || []).map((e) => ({
    userId: e.id,
    startDate: toDateInputValue(e.assignedAt),
    endDate: e.endDate ? toDateInputValue(e.endDate) : "",
  }));

// Standalone "who's on this project" editor - opened by clicking a project
// row on the Report page. Adds/removes members and tweaks their per-project
// start/end dates, nothing else about the project. Project details
// (type/timezone/hours/dates) stay in EditProjectModal.
export default function ManageProjectMembersModal({ project, onClose, onSuccess }) {
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

  return (
    <Modal title={`Members · ${project.name}`} onClose={onClose} wide>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <p className="helper-text" style={{ marginTop: 0 }}>
          Check an employee to add them to this project, uncheck to remove them. Members see
          this project's type, timezone, working hours and submission frequency automatically.
        </p>

        <ProjectMembersField
          members={members}
          onChange={setMembers}
          recentHint={recentMembers}
        />

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save members
          </Button>
        </div>
      </form>
    </Modal>
  );
}
