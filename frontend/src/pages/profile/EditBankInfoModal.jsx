import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import ProfileDocField from "./ProfileDocField";

// bankAccountNumber arrives already masked - same reasoning as
// EditStatutoryInfoModal, it starts blank and is only sent if the employee
// types a fresh one in.
export default function EditBankInfoModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    bankAccountNumber: "",
    bankName: user?.bankName || "",
    ifscCode: user?.ifscCode || "",
  });
  const [bankFile, setBankFile] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    Boolean(bankFile) ||
    form.bankAccountNumber ||
    form.bankName !== (user?.bankName || "") ||
    form.ifscCode !== (user?.ifscCode || "");

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      await profileApi.updateMyBankInfo(form, { bankDocument: bankFile });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your changes. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Edit Bank Information" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <form onSubmit={handleSubmit} noValidate>
        <p className="helper-text" style={{ marginTop: 0 }}>
          Salary / CTC can only be changed by your admin. Your account number is shown masked - leave it blank to
          keep the current value. Changes take effect immediately.
        </p>

        <TextInput
          label={`Bank account number (currently ${user?.bankAccountNumber || "not set"})`}
          placeholder="Leave blank to keep current"
          value={form.bankAccountNumber}
          onChange={(e) => update("bankAccountNumber", e.target.value)}
        />

        <div className="form-two-col">
          <TextInput label="Bank name" value={form.bankName} onChange={(e) => update("bankName", e.target.value)} />
          <TextInput label="IFSC code" value={form.ifscCode} onChange={(e) => update("ifscCode", e.target.value)} />
        </div>

        <ProfileDocField
          label="Bank proof (passbook / cancelled cheque)"
          docType="bank"
          hasDocument={Boolean(user?.hasBankDocument)}
          file={bankFile}
          onPick={setBankFile}
        />

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
