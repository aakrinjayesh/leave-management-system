import { useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const toForm = (policy) => ({
  leaveName: policy?.leaveName ?? "",
  allocatedLeaves: policy?.allocatedLeaves ?? 12,
  maxLeavesPerRequest: policy?.maxLeavesPerRequest ?? 5,
  isUnlimited: policy?.isUnlimited ?? false,
  isUnpaid: policy?.isUnpaid ?? false,
  allowHalfDay: policy?.allowHalfDay ?? true,
  description: policy?.description ?? "",
});

export default function LeavePolicyModal({ policy, onClose, onSuccess }) {
  const [form, setForm] = useState(toForm(policy));
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const handleCheck = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.checked }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.leaveName.trim()) {
      setError("Please enter a name for this leave type.");
      return;
    }

    const payload = {
      leaveName: form.leaveName.trim(),
      allocatedLeaves: Number(form.allocatedLeaves),
      maxLeavesPerRequest: Number(form.maxLeavesPerRequest),
      isUnlimited: form.isUnlimited,
      isUnpaid: form.isUnpaid,
      allowHalfDay: form.allowHalfDay,
      description: form.description.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (policy) {
        await adminApi.updateLeavePolicy(policy.id, payload);
      } else {
        await adminApi.createLeavePolicy(payload);
      }
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this leave type. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={policy ? "Edit leave type" : "Add leave type"} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <form onSubmit={handleSubmit} noValidate>
        <TextInput label="Leave name" placeholder="e.g. Casual Leave" value={form.leaveName} onChange={handleChange("leaveName")} />

        <div className="form-two-col">
          <TextInput
            label="Days per year"
            type="number"
            min="0"
            value={form.allocatedLeaves}
            onChange={handleChange("allocatedLeaves")}
            disabled={form.isUnlimited}
          />
          <TextInput
            label="Max days per request"
            type="number"
            min="1"
            value={form.maxLeavesPerRequest}
            onChange={handleChange("maxLeavesPerRequest")}
          />
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={form.isUnlimited} onChange={handleCheck("isUnlimited")} />
          Unlimited (no yearly cap)
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={form.isUnpaid} onChange={handleCheck("isUnpaid")} />
          Unpaid (Loss of Pay) - deducts salary on payslips for approved days
        </label>

        <label className="checkbox-row">
          <input type="checkbox" checked={form.allowHalfDay} onChange={handleCheck("allowHalfDay")} />
          Allow half-day requests
        </label>

        <TextArea
          label="Description (optional)"
          value={form.description}
          onChange={handleChange("description")}
        />

        <p className="helper-text">
          Changing the yearly allocation only affects balances not yet created (new employees, or next year) -
          it won't change what employees have already been allocated and used this year.
        </p>

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {policy ? "Save changes" : "Add leave type"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
