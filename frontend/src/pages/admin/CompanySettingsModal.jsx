import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import FormSelect from "../../components/common/FormSelect";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CompanySettingsModal({ onClose, onSuccess }) {
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(null);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    adminApi.getCompanySettings().then((data) => setFiscalYearStartMonth(data.settings.fiscalYearStartMonth));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    setIsSaving(true);
    try {
      await adminApi.updateCompanySettings({ fiscalYearStartMonth: Number(fiscalYearStartMonth) });
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save company settings. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Company settings" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {fiscalYearStartMonth === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="helper-text">
            Leave balances (Casual/Sick/Earned) and payslip year-to-date totals both reset on the 1st of this month
            every year, instead of a fixed January 1st.
          </p>

          <FormSelect
            label="Our year starts in"
            value={fiscalYearStartMonth}
            onChange={(e) => setFiscalYearStartMonth(e.target.value)}
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </FormSelect>

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
