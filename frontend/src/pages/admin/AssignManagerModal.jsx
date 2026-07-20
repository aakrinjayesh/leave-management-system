import { useState } from "react";
import Modal from "../../components/common/Modal";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

export default function AssignManagerModal({ user, allUsers, onClose, onSuccess }) {
  const [managerId, setManagerId] = useState(user.managerId ? String(user.managerId) : "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = allUsers.filter((u) => u.id !== user.id && u.status === "ACTIVE");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    setIsSubmitting(true);
    try {
      await adminApi.updateUserManager(user.id, managerId ? Number(managerId) : null);
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't update this account's manager. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Set manager — ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <FormSelect label="Manager" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
          <option value="">No manager</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.firstName} {option.lastName} — {option.email}
            </option>
          ))}
        </FormSelect>

        <p className="helper-text">
          Any pending leave requests from this account will move to the new manager immediately.
        </p>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
