import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import FormSelect from "../../components/common/FormSelect";
import TextInput from "../../components/common/TextInput";
import TextArea from "../../components/common/TextArea";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as commonApi from "../../api/common.api";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const INITIAL_FORM = {
  leavePolicyId: "",
  startDate: "",
  endDate: "",
  isHalfDay: false,
  reason: "",
};

export default function LogLeaveForEmployeeModal({ employee, onClose, onSuccess }) {
  const [policies, setPolicies] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    commonApi
      .getLeavePolicies()
      .then((data) => setPolicies(data.policies))
      .catch(() => setError("Couldn't load the form options. Please try again."))
      .finally(() => setIsLoadingOptions(false));
  }, []);

  const selectedPolicy = policies.find((p) => String(p.id) === String(form.leavePolicyId));
  const isSingleDay = form.startDate && form.startDate === form.endDate;

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.leavePolicyId || !form.startDate || !form.endDate || !form.reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await managerLeaveApi.createLeaveForEmployee(employee.id, {
        leavePolicyId: Number(form.leavePolicyId),
        startDate: form.startDate,
        endDate: form.endDate,
        isHalfDay: isSingleDay ? form.isHalfDay : false,
        reason: form.reason.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't log this leave. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Log leave for ${employee.firstName} ${employee.lastName}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {isLoadingOptions ? (
        <p className="helper-text">Loading form options…</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="helper-text" style={{ marginTop: 0 }}>
            This is recorded and approved immediately - no separate approval step. Use it to log leave the employee
            told you about directly (e.g. over phone, or backdating an already-taken day).
          </p>

          <FormSelect label="Leave type" value={form.leavePolicyId} onChange={handleChange("leavePolicyId")}>
            <option value="">Select a leave type</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.leaveName}
              </option>
            ))}
          </FormSelect>

          <div className="form-two-col">
            <TextInput label="Start date" type="date" value={form.startDate} onChange={handleChange("startDate")} />
            <TextInput
              label="End date"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={handleChange("endDate")}
            />
          </div>

          {isSingleDay && selectedPolicy?.allowHalfDay && (
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isHalfDay} onChange={handleChange("isHalfDay")} />
              Half-day leave
            </label>
          )}

          <TextArea
            label="Reason"
            placeholder="Briefly describe the reason for this leave"
            value={form.reason}
            onChange={handleChange("reason")}
          />

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Log and approve
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
