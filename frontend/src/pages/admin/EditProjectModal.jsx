import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { PROJECT_TYPE_OPTIONS, TIMEZONE_OPTIONS, toEditableTimezoneValue } from "../../utils/projectOptions";

const toForm = (project) => ({
  name: project.name,
  projectType: project.projectType,
  timezone: toEditableTimezoneValue(project.timezone),
  workStartTime: project.workStartTime,
  workEndTime: project.workEndTime,
});

export default function EditProjectModal({ project, onClose, onSuccess }) {
  const [form, setForm] = useState(toForm(project));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

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

    setIsSubmitting(true);
    try {
      await adminApi.updateProject(project.id, { ...form, name: form.name.trim() });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this project. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Edit project" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput label="Project name" value={form.name} onChange={handleChange("name")} />

        <div className="form-two-col">
          <FormSelect label="Project type" value={form.projectType} onChange={handleChange("projectType")}>
            {PROJECT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FormSelect>
          <TextInput
            label="Timezone"
            list="timezone-suggestions"
            placeholder="e.g. India (IST, UTC+5:30)"
            value={form.timezone}
            onChange={handleChange("timezone")}
          />
        </div>
        <datalist id="timezone-suggestions">
          {TIMEZONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.label} />
          ))}
        </datalist>

        <div className="form-two-col">
          <TextInput
            label="Working hours start"
            type="time"
            value={form.workStartTime}
            onChange={handleChange("workStartTime")}
          />
          <TextInput
            label="Working hours end"
            type="time"
            value={form.workEndTime}
            onChange={handleChange("workEndTime")}
          />
        </div>

        <p className="helper-text">
          Employees will see this project type, timezone and working hours automatically once they select this
          project on their timesheet.
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
