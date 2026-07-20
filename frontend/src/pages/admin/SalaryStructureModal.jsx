import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const toForm = (config) => ({
  basicPercentOfCtc: config.basicPercentOfCtc,
  hraPercentOfBasic: config.hraPercentOfBasic,
  ltaPercentOfBasic: config.ltaPercentOfBasic,
  guaranteedAllowancePercentOfBasic: config.guaranteedAllowancePercentOfBasic,
  conveyanceMonthly: config.conveyanceMonthly,
  pfMonthlyAmount: config.pfMonthlyAmount,
  professionalTax: config.professionalTax,
  professionalTaxThreshold: config.professionalTaxThreshold,
});

export default function SalaryStructureModal({ onClose, onSuccess }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    adminApi.getSalaryStructure().then((data) => setForm(toForm(data.config)));
  }, []);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    setIsSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, Number(value)]));
      await adminApi.updateSalaryStructure(payload);
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the salary structure. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Salary structure settings" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {!form ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="helper-text">
            Applies to every employee's payslip - each component is calculated from their Salary/CTC using these
            percentages. Special Allowance automatically absorbs whatever's left over.
          </p>

          <div className="form-two-col">
            <TextInput
              label="Basic (% of monthly CTC)"
              type="number"
              min="0"
              max="100"
              value={form.basicPercentOfCtc}
              onChange={handleChange("basicPercentOfCtc")}
            />
            <TextInput
              label="HRA (% of Basic)"
              type="number"
              min="0"
              value={form.hraPercentOfBasic}
              onChange={handleChange("hraPercentOfBasic")}
            />
          </div>

          <div className="form-two-col">
            <TextInput
              label="LTA (% of Basic)"
              type="number"
              min="0"
              value={form.ltaPercentOfBasic}
              onChange={handleChange("ltaPercentOfBasic")}
            />
            <TextInput
              label="Guaranteed Allowance (% of Basic)"
              type="number"
              min="0"
              value={form.guaranteedAllowancePercentOfBasic}
              onChange={handleChange("guaranteedAllowancePercentOfBasic")}
            />
          </div>

          <div className="form-two-col">
            <TextInput
              label="Conveyance (₹/month, fixed)"
              type="number"
              min="0"
              value={form.conveyanceMonthly}
              onChange={handleChange("conveyanceMonthly")}
            />
            <TextInput
              label="PF (₹/month, fixed - same for everyone)"
              type="number"
              min="0"
              value={form.pfMonthlyAmount}
              onChange={handleChange("pfMonthlyAmount")}
            />
          </div>

          <div className="form-two-col">
            <TextInput
              label="Professional Tax (₹/month, fixed)"
              type="number"
              min="0"
              value={form.professionalTax}
              onChange={handleChange("professionalTax")}
            />
            <TextInput
              label="PT applies once gross monthly pay reaches (₹)"
              type="number"
              min="0"
              value={form.professionalTaxThreshold}
              onChange={handleChange("professionalTaxThreshold")}
            />
          </div>
          <p className="helper-text">Below this gross monthly pay, Professional Tax is ₹0.</p>

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
