import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import FormSelect from "../../components/common/FormSelect";
import MonthPicker from "../../components/common/MonthPicker";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonth = (date) =>
  new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const isoToMonth = (value) => (value ? new Date(value).toISOString().slice(0, 7) : "");

const BLANK_FORM = { grossPayment: "", tdsRatePercent: "10", effectiveFrom: "" };

const toStartingForm = (history, mode) => {
  if (!history || history.length === 0) return BLANK_FORM;
  const latest = history[0];
  return {
    grossPayment: latest.grossPayment,
    tdsRatePercent: String(latest.tdsRatePercent),
    effectiveFrom: mode === "edit" ? isoToMonth(latest.effectiveFrom) : "",
  };
};

// Contract-hire only. Sets Gross Payment + TDS rate effective from a given
// month. "update" adds a new dated entry; "edit" overwrites the latest one in
// place. Completely separate from UpdateSalaryStructureModal.
export default function UpdateContractPaymentModal({ userId, mode = "update", onClose, onSuccess }) {
  const isEdit = mode === "edit";
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadHistory = () =>
    adminApi.getContractPaymentStructureHistory(userId).then((data) => {
      setHistory(data.history);
      setForm(toStartingForm(data.history, mode));
    });

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gross = Number(form.grossPayment) || 0;
  const rate = Number(form.tdsRatePercent) || 0;
  const tdsAmount = (gross * rate) / 100;
  const netPayment = gross - tdsAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.grossPayment || Number(form.grossPayment) < 0) {
      setError("Please enter a valid Gross Payment amount.");
      return;
    }
    if (!["2", "10"].includes(String(form.tdsRatePercent))) {
      setError("Please choose a TDS rate (2% or 10%).");
      return;
    }
    if (!form.effectiveFrom) {
      setError("Please choose the month this applies from.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        grossPayment: Number(form.grossPayment),
        tdsRatePercent: Number(form.tdsRatePercent),
        effectiveFrom: form.effectiveFrom,
      };
      if (isEdit) {
        await adminApi.updateLatestContractPaymentStructure(userId, payload);
      } else {
        await adminApi.recordContractPaymentStructure(userId, payload);
      }
      await loadHistory();
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this contract payment. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit contract payment" : "Update contract payment"} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <p className="helper-text">
        {isEdit
          ? "Corrects the current (most recent) contract payment in place - the values below are pre-filled from it. Saving overwrites that same entry."
          : "Sets the Gross Payment and TDS rate for this contract hire, effective from the chosen month. Net Payment = Gross Payment less TDS."}
      </p>

      {!history ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-two-col">
            <div className="field">
              <label className="field-label" htmlFor="contract-effective-from">
                Effective from
              </label>
              <div className="field-input-wrap">
                <MonthPicker
                  id="contract-effective-from"
                  value={form.effectiveFrom}
                  onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
                />
              </div>
            </div>
            <TextInput
              label="Gross Payment (₹ / month)"
              type="number"
              min="0"
              value={form.grossPayment}
              onChange={(e) => setForm((prev) => ({ ...prev, grossPayment: e.target.value }))}
            />
          </div>

          <FormSelect
            label="TDS rate"
            value={form.tdsRatePercent}
            onChange={(e) => setForm((prev) => ({ ...prev, tdsRatePercent: e.target.value }))}
          >
            <option value="2">TDS @ 2%</option>
            <option value="10">TDS @ 10%</option>
          </FormSelect>

          <div className="profile-detail-grid" style={{ marginTop: 8 }}>
            <div>
              <div className="profile-detail-label">TDS amount</div>
              <div className="profile-detail-value">{money(tdsAmount)}</div>
            </div>
            <div>
              <div className="profile-detail-label">Net Payment</div>
              <div className="profile-detail-value">
                <strong>{money(netPayment)}</strong>
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <Button type="submit" isLoading={isSaving}>
              {isEdit ? "Save changes" : "Add entry"}
            </Button>
          </div>
        </form>
      )}

      {history && history.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span className="card-section-title">History</span>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Effective from</th>
                  <th>Gross Payment</th>
                  <th>TDS rate</th>
                  <th>TDS amount</th>
                  <th>Net Payment</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const t = (entry.grossPayment * entry.tdsRatePercent) / 100;
                  return (
                    <tr key={entry.id}>
                      <td className="table-cell-primary">{formatMonth(entry.effectiveFrom)}</td>
                      <td className="table-cell-secondary">{money(entry.grossPayment)}</td>
                      <td className="table-cell-secondary">{entry.tdsRatePercent}%</td>
                      <td className="table-cell-secondary">{money(t)}</td>
                      <td className="table-cell-secondary">{money(entry.grossPayment - t)}</td>
                      <td className="table-cell-secondary">
                        {entry.recordedBy ? `${entry.recordedBy.firstName} ${entry.recordedBy.lastName}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
