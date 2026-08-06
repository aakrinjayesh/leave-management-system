import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile } from "../../utils/openBlob";

const todayDateInputValue = () => new Date().toISOString().slice(0, 10);

const formatLetterDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "an unspecified date";

const buildDefaultLetterText = (employee, exitDate) =>
  `This is to certify that ${employee.firstName} ${employee.lastName}, who was working with Aakrin Consulting Services Private Limited as ${
    employee.designation || "an employee"
  }, has been relieved from their duties effective ${formatLetterDate(exitDate)}. We appreciate their contribution during their tenure with us from ${formatLetterDate(
    employee.joiningDate
  )} and wish them success in their future endeavors.`;

// Replaces the plain "deactivate" action - records a permanent exit event
// (with an editable relieving letter) and marks the account INACTIVE.
export default function ExitModal({ user, onClose, onSuccess }) {
  const [employee, setEmployee] = useState(null);
  const [exitDate, setExitDate] = useState(todayDateInputValue());
  const [letterText, setLetterText] = useState("");
  const [hasEditedLetter, setHasEditedLetter] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [completedRecord, setCompletedRecord] = useState(null);

  useEffect(() => {
    adminApi.getUserDetails(user.id).then((data) => setEmployee(data.user));
  }, [user.id]);

  // Auto-fills the letter once employee details are loaded, but never
  // overwrites text the admin has already started editing.
  useEffect(() => {
    if (!employee || hasEditedLetter) return;
    setLetterText(buildDefaultLetterText(employee, exitDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!exitDate) {
      setError("Please choose an exit date.");
      return;
    }
    if (!letterText.trim()) {
      setError("Please provide the relieving letter text.");
      return;
    }

    setIsSaving(true);
    try {
      const data = await adminApi.recordExit(user.id, { exitDate, relievingLetterText: letterText });
      setCompletedRecord(data.exitRecord);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't process this exit. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await adminApi.downloadRelievingLetterPdf(completedRecord.id);
      downloadBlobAsFile(response.data, `relieving-letter-${user.firstName}-${user.lastName}.pdf`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download the relieving letter."));
    }
  };

  if (completedRecord) {
    return (
      <Modal title="Account exited" onClose={() => onSuccess()}>
        <Alert type="success">
          {user.firstName} {user.lastName}'s account has been marked inactive.
        </Alert>
        <p className="helper-text">You can download their relieving letter now, or anytime later.</p>
        <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
          <Button type="button" onClick={handleDownload}>
            Download relieving letter
          </Button>
          <Button type="button" variant="secondary" onClick={() => onSuccess()}>
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Exit ${user.firstName} ${user.lastName}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <p className="helper-text">
        This marks the account inactive and records a relieving letter. Review or edit the text below before
        confirming.
      </p>

      {!employee ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <TextInput
            label="Exit date"
            type="date"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />

          <TextArea
            label="Relieving letter text"
            rows={7}
            value={letterText}
            onChange={(e) => {
              setHasEditedLetter(true);
              setLetterText(e.target.value);
            }}
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Exit
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
