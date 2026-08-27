import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import TimeOfDayField from "../../components/common/TimeOfDayField";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import {
  PROJECT_TYPE_OPTIONS,
  SUBMISSION_FREQUENCY_OPTIONS,
  toEditableTimezoneValue,
} from "../../utils/projectOptions";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const toForm = (project) => ({
  name: project.name,
  projectType: project.projectType,
  timezone: toEditableTimezoneValue(project.timezone),
  workStartTime: project.workStartTime,
  workEndTime: project.workEndTime,
  startDate: toDateInputValue(project.startDate),
  endDate: project.endDate ? toDateInputValue(project.endDate) : "",
  submissionFrequency: project.submissionFrequency,
});

export default function EditProjectModal({ project, onClose, onSuccess }) {
  const [form, setForm] = useState(toForm(project));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter a project name.");
      return;
    }
    if (form.workEndTime <= form.workStartTime) {
      setError("End time must be after the start time.");
      return;
    }
    if (!form.startDate) {
      setError("Please set a project start date.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      setError("End date can't be before the start date.");
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.updateProject(project.id, {
        ...form,
        name: form.name.trim(),
        endDate: form.endDate || null,
      });
      onSuccess();
    } catch (err) {
      setError(
        getErrorMessage(err, "Couldn't save this project. Please try again."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Edit project" onClose={onClose} wide>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <p className="modal-section-title">Project details</p>

        <TextInput
          label="Project name"
          value={form.name}
          onChange={handleChange("name")}
        />

        <div className="form-two-col">
          <FormSelect
            label="Project type"
            value={form.projectType}
            onChange={handleChange("projectType")}
          >
            {PROJECT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <TextInput
            label="Timezone"
            placeholder="e.g. India (IST, UTC+5:30)"
            value={form.timezone}
            onChange={handleChange("timezone")}
          />
        </div>

        <hr className="modal-section-divider" />
        <p className="modal-section-title">Schedule &amp; working hours</p>

        <div className="form-two-col">
          <TextInput
            label="Project Start date"
            type="date"
            value={form.startDate}
            onChange={handleChange("startDate")}
          />
          <TextInput
            label="Project End date"
            type="date"
            value={form.endDate}
            onChange={handleChange("endDate")}
          />
        </div>

        <div className="form-three-col">
          <TimeOfDayField
            label="Working hours start"
            value={form.workStartTime}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, workStartTime: value }))
            }
          />
          <TimeOfDayField
            label="Working hours end"
            value={form.workEndTime}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, workEndTime: value }))
            }
          />
          <FormSelect
            label="Timesheet submission"
            value={form.submissionFrequency}
            onChange={handleChange("submissionFrequency")}
          >
            {SUBMISSION_FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
        </div>

        <p className="helper-text">
          Employees will see this project type, timezone, working hours and
          submission frequency automatically once they're added to the project.
          Manage who's on it by clicking the project row.
        </p>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
