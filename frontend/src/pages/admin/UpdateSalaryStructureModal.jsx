import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import TextInput from "../../components/common/TextInput";
import MonthPicker from "../../components/common/MonthPicker";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const money = (value) => `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonth = (date) => new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

const STRUCTURE_FIELDS = [
  "basicPercentOfCtc",
  "hraPercentOfBasic",
  "ltaPercentOfBasic",
  "guaranteedAllowancePercentOfBasic",
  "conveyanceMonthly",
  "pfMonthlyAmount",
  "professionalTax",
  "professionalTaxThreshold",
];

const BLANK_FORM = { ctc: "", effectiveFrom: "", ...Object.fromEntries(STRUCTURE_FIELDS.map((f) => [f, ""])) };

const isoToMonth = (value) => (value ? new Date(value).toISOString().slice(0, 7) : "");

// Pre-fills CTC + structure fields from the most recent entry on file (so
// admin only tweaks what changed), or starts fully blank for an employee
// who has never had a structure recorded yet. In "edit" mode the effective
// month is pre-filled too (you're correcting that exact entry); in "update"
// mode it's left blank so the admin picks a new month for the revision.
const toStartingForm = (history, mode) => {
  if (!history || history.length === 0) return BLANK_FORM;
  const latest = history[0];
  return {
    ctc: latest.ctc,
    effectiveFrom: mode === "edit" ? isoToMonth(latest.effectiveFrom) : "",
    ...Object.fromEntries(STRUCTURE_FIELDS.map((f) => [f, latest[f]])),
  };
};

// Replaces the old company-wide Salary Structure settings - each employee
// now has their own CTC + Basic/HRA/LTA/etc. percentages, recorded per
// effective month exactly like CTC history worked before.
export default function UpdateSalaryStructureModal({ userId, mode = "update", onClose, onSuccess }) {
  const isEdit = mode === "edit";
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadHistory = () =>
    adminApi.getSalaryStructureHistory(userId).then((data) => {
      setHistory(data.history);
      setForm(toStartingForm(data.history, mode));
    });

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.ctc || Number(form.ctc) < 0) {
      setError("Please enter a valid CTC amount.");
      return;
    }
    if (!form.effectiveFrom) {
      setError("Please choose the month this applies from.");
      return;
    }
    if (STRUCTURE_FIELDS.some((f) => form[f] === "" || Number(form[f]) < 0)) {
      setError("Please fill in every salary structure field with a valid, non-negative number.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ctc: Number(form.ctc),
        effectiveFrom: form.effectiveFrom,
        ...Object.fromEntries(STRUCTURE_FIELDS.map((f) => [f, Number(form[f])])),
      };
      if (isEdit) {
        await adminApi.updateLatestSalaryStructure(userId, payload);
      } else {
        await adminApi.recordSalaryStructure(userId, payload);
      }
      await loadHistory();
      if (!isEdit) setForm((prev) => ({ ...prev, effectiveFrom: "" }));
      onSuccess();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this salary structure. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit salary" : "Update salary structure"} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <p className="helper-text">
        {isEdit
          ? "Corrects the current (most recent) salary structure in place - the values below are pre-filled from it. Saving overwrites that same entry; it does not create a new revision or a past-structure entry."
          : "Each entry is this employee's CTC and salary breakdown effective from a given month onward - payslips use whichever entry was effective for their own month. Backdating an entry only affects past-month calculations; it won't change what's currently active unless it's the most recent entry."}
      </p>

      {!history ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-two-col">
            <div className="field">
              <label className="field-label" htmlFor="structure-effective-from">
                Effective from
              </label>
              <div className="field-input-wrap">
                <MonthPicker id="structure-effective-from" value={form.effectiveFrom} onChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))} />
              </div>
            </div>
            <TextInput label="CTC (annual)" type="number" min="0" value={form.ctc} onChange={handleChange("ctc")} />
          </div>

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
              label="PF (₹/month, fixed)"
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
                  <th>CTC</th>
                  <th>Basic %</th>
                  <th>HRA %</th>
                  <th>LTA %</th>
                  <th>Guaranteed Allowance %</th>
                  <th>Conveyance</th>
                  <th>PF</th>
                  <th>Professional Tax</th>
                  <th>PT threshold</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="table-cell-primary">{formatMonth(entry.effectiveFrom)}</td>
                    <td className="table-cell-secondary">{money(entry.ctc)}</td>
                    <td className="table-cell-secondary">{entry.basicPercentOfCtc}%</td>
                    <td className="table-cell-secondary">{entry.hraPercentOfBasic}%</td>
                    <td className="table-cell-secondary">{entry.ltaPercentOfBasic}%</td>
                    <td className="table-cell-secondary">{entry.guaranteedAllowancePercentOfBasic}%</td>
                    <td className="table-cell-secondary">{money(entry.conveyanceMonthly)}</td>
                    <td className="table-cell-secondary">{money(entry.pfMonthlyAmount)}</td>
                    <td className="table-cell-secondary">{money(entry.professionalTax)}</td>
                    <td className="table-cell-secondary">{money(entry.professionalTaxThreshold)}</td>
                    <td className="table-cell-secondary">
                      {entry.recordedBy ? `${entry.recordedBy.firstName} ${entry.recordedBy.lastName}` : "—"}
                    </td>
                  </tr>
                ))}
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
