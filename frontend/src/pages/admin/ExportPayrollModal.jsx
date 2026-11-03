import { useState } from "react";
import Modal from "../../components/common/Modal";
import MonthPicker from "../../components/common/MonthPicker";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile } from "../../utils/openBlob";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const DETAIL_COLUMNS = [
  ["employeeCode", "Employee code"],
  ["name", "Name"],
  ["designation", "Designation"],
  ["email", "Email"],
  ["joiningDate", "Joining date"],
  ["pan", "PAN"],
  ["uan", "UAN"],
  ["pfNumber", "PF number"],
  ["bankName", "Bank"],
  ["bankAccountNumber", "Account number"],
  ["ifscCode", "IFSC"],
  ["ctc", "CTC (annual)"],
];

const FIELD_LABELS = {
  standardDays: "Standard Days",
  daysWorked: "Days Worked",
  lopDays: "LOP Days",
  basic: "Basic",
  hra: "HRA",
  lta: "LTA",
  conveyance: "Conveyance",
  guaranteedAllowance: "Guaranteed Allowance",
  specialAllowance: "Special Allowance",
  annualBonusPay: "Annual Bonus",
  grossPay: "Gross Pay",
  pfEmployee: "PF (Employee)",
  pfEmployer: "PF (Employer)",
  professionalTax: "Professional Tax",
  tds: "TDS",
  lopAmount: "LOP Amount",
  grossDeductions: "Gross Deductions",
  netPay: "Net Pay",
};

const DAY_FIELDS = new Set(["standardDays", "daysWorked", "lopDays"]);

const formatDetail = (key, value) => {
  if (value == null || value === "") return "";
  if (key === "joiningDate") return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  if (key === "ctc") return Number(value).toFixed(2);
  return value;
};

const buildCsv = ({ fields, rows }, title) => {
  const line = (values) => values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  const header = [...DETAIL_COLUMNS.map(([, label]) => label), "Payslip generated", ...fields.map((f) => FIELD_LABELS[f] || f)];
  const body = rows.map((row) =>
    line([
      ...DETAIL_COLUMNS.map(([key]) => formatDetail(key, row[key])),
      row.hasPayslip ? "Yes" : "No",
      ...fields.map((f) => (row[f] == null ? "" : DAY_FIELDS.has(f) ? row[f] : Number(row[f]).toFixed(2))),
    ])
  );
  return [title, line(header), ...body].join("\r\n");
};

// Export Payroll: one CSV row per salaried employee for the chosen month -
// their personal / bank / statutory details plus every payslip figure.
// Employees whose payslip isn't generated yet still appear, with blank figures.
export default function ExportPayrollModal({ onClose }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setError("");
    setIsExporting(true);
    try {
      const [year, month] = monthValue.split("-").map(Number);
      const data = await adminApi.exportPayroll(year, month);
      const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
      const csv = buildCsv(data, `Payroll export - ${label}`);
      // Leading BOM so Excel opens it as UTF-8 (non-English names stay intact).
      downloadBlobAsFile(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" }), `Payroll_Export_${label.replace(" ", "")}.csv`);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't export payroll. Please try again."));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal title="Export payroll" onClose={onClose}>
      <Alert type="error">{error}</Alert>

      <p className="helper-text">
        Downloads a spreadsheet (CSV) with every salaried employee&apos;s details and payslip figures for the chosen month.
        Employees whose payslip hasn&apos;t been generated yet are included with blank figures.
      </p>

      <div className="field">
        <label className="field-label" htmlFor="export-payroll-month">
          Month
        </label>
        <div className="field-input-wrap">
          <MonthPicker id="export-payroll-month" value={monthValue} onChange={setMonthValue} />
        </div>
      </div>

      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" onClick={handleExport} isLoading={isExporting}>
          Download CSV
        </Button>
      </div>
    </Modal>
  );
}
