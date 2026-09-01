import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import ProfileDocField from "./ProfileDocField";

// pan/uan/aadharNumber arrive already masked (e.g. "******234F") - there's
// no way to prefill an editable field with the real value, so these start
// blank and only get sent to the backend if the employee actually types a
// fresh one in (see updateMyStatutoryInfoSchema on the backend, which treats
// a blank/omitted field as "leave this alone").
export default function EditStatutoryInfoModal({ user, editsRemaining, onClose, onSaved }) {
  const [form, setForm] = useState({
    pan: "",
    panHolderName: user?.panHolderName || "",
    uan: "",
    aadharNumber: "",
    aadharHolderName: user?.aadharHolderName || "",
  });
  const [panFile, setPanFile] = useState(null);
  const [aadharFile, setAadharFile] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    Boolean(panFile) || Boolean(aadharFile) ||
    form.pan || form.uan || form.aadharNumber ||
    form.panHolderName !== (user?.panHolderName || "") ||
    form.aadharHolderName !== (user?.aadharHolderName || "");

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await profileApi.updateMyStatutoryInfo(form, { panDocument: panFile, aadharDocument: aadharFile });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your changes. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit Statutory Information" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <p className="helper-text" style={{ marginTop: 0 }}>
          PF number can only be changed by your admin. Sensitive numbers below are shown masked - leave a field
          blank to keep its current value. Changes are sent to admin for approval before they take effect. You have{" "}
          <strong>{editsRemaining}</strong> request{editsRemaining === 1 ? "" : "s"} left for this section.
        </p>

        <div className="form-two-col">
          <TextInput
            label={`PAN number (currently ${user?.pan || "not set"})`}
            placeholder="Leave blank to keep current"
            value={form.pan}
            onChange={(e) => update("pan", e.target.value)}
          />
          <TextInput
            label="Name as per PAN"
            value={form.panHolderName}
            onChange={(e) => update("panHolderName", e.target.value)}
          />
        </div>

        <div className="form-two-col">
          <TextInput
            label={`UAN (currently ${user?.uan || "not set"})`}
            placeholder="Leave blank to keep current"
            value={form.uan}
            onChange={(e) => update("uan", e.target.value)}
          />
          <TextInput
            label={`Aadhaar number (currently ${user?.aadharNumber || "not set"})`}
            placeholder="Leave blank to keep current"
            value={form.aadharNumber}
            onChange={(e) => update("aadharNumber", e.target.value)}
          />
        </div>

        <TextInput
          label="Name as per Aadhaar"
          value={form.aadharHolderName}
          onChange={(e) => update("aadharHolderName", e.target.value)}
        />

        <div className="form-two-col">
          <ProfileDocField
            label="PAN card document"
            docType="pan"
            hasDocument={Boolean(user?.hasPanDocument)}
            file={panFile}
            onPick={setPanFile}
          />
          <ProfileDocField
            label="Aadhaar card (PDF only)"
            docType="aadhar"
            hasDocument={Boolean(user?.hasAadharDocument)}
            file={aadharFile}
            onPick={setAadharFile}
            accept=".pdf"
          />
        </div>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
