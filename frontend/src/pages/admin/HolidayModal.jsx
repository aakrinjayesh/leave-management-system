import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const todayValue = () => new Date().toISOString().slice(0, 10);

const toForm = (holiday) => ({
  holidayName: holiday?.holidayName ?? "",
  holidayDate: holiday ? holiday.holidayDate.slice(0, 10) : "",
  isOptional: holiday?.isOptional ?? false,
  description: holiday?.description ?? "",
});

export default function HolidayModal({ holiday, onClose, onSuccess }) {
  const [form, setForm] = useState(toForm(holiday));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleCheck = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.holidayName.trim()) {
      setError("Please enter a name for this holiday.");
      return;
    }
    if (!form.holidayDate) {
      setError("Please pick a date.");
      return;
    }

    const payload = {
      holidayName: form.holidayName.trim(),
      holidayDate: form.holidayDate,
      isOptional: form.isOptional,
      description: form.description.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (holiday) {
        await adminApi.updateHoliday(holiday.id, payload);
      } else {
        await adminApi.createHoliday(payload);
      }
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this holiday. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={holiday ? "Edit holiday" : "Add holiday"} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput
          label="Holiday name"
          placeholder="e.g. Diwali"
          value={form.holidayName}
          onChange={handleChange("holidayName")}
        />

        <TextInput
          label="Date"
          type="date"
          min={todayValue()}
          value={form.holidayDate}
          onChange={handleChange("holidayDate")}
        />

        <label className="checkbox-row">
          <input type="checkbox" checked={form.isOptional} onChange={handleCheck("isOptional")} />
          Optional holiday
        </label>

        <TextArea
          label="Description (optional)"
          value={form.description}
          onChange={handleChange("description")}
        />

        <p className="helper-text">Only today or future dates can be set - past holidays can't be added or edited.</p>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {holiday ? "Save changes" : "Add holiday"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
