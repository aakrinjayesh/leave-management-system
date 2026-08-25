import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

// Earliest date the picker allows - "YYYY-MM-DD". Only rules out the past;
// no minimum notice period is enforced on the date itself.
const getMinLastWorkingDate = () => new Date().toISOString().slice(0, 10);

export default function ResignationModal({ user, onClose, onSubmitted }) {
  const [reason, setReason] = useState("");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minDate = getMinLastWorkingDate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for your resignation.");
      return;
    }
    if (!lastWorkingDate) {
      setError("Please choose your last working day.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await profileApi.submitResignation(reason.trim(), lastWorkingDate);
      onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't submit your resignation. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Submit Resignation" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <div className="profile-detail-grid" style={{ marginBottom: 16 }}>
          <div>
            <div className="profile-detail-label">Designation</div>
            <div className="profile-detail-value">{user?.designation || "Not set"}</div>
          </div>
          <div>
            <div className="profile-detail-label">Employee code</div>
            <div className="profile-detail-value">{user?.employeeCode || "Not set"}</div>
          </div>
        </div>

        <TextInput
          label="Last working day"
          type="date"
          min={minDate}
          value={lastWorkingDate}
          onChange={(e) => setLastWorkingDate(e.target.value)}
        />

        <TextArea
          label="Reason for resignation"
          placeholder="Let your manager and admin know why you're resigning"
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        <p className="helper-text">
          This will be sent to your manager (view only) and admin. Admin accepting confirms this last working day -
          it doesn't change it.
        </p>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Submit resignation
          </Button>
        </div>
      </form>
    </Modal>
  );
}
