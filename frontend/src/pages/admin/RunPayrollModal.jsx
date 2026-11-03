import { useState } from "react";
import Modal from "../../components/common/Modal";
import MonthPicker from "../../components/common/MonthPicker";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const monthLabel = (value) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
};

const formatDay = (key) => new Date(`${key}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

// runPayroll is requested as a blob, so a JSON error body arrives as a Blob
// too - read it back to get the server's message.
const readBlobError = async (err, fallback) => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return getErrorMessage(err, fallback);
};

// Run Payroll: pick a month, check it (every working day of every salaried
// employee must be marked - otherwise the run is blocked and the names are
// listed), then generate all payslips and download them as one ZIP.
export default function RunPayrollModal({ onClose }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [check, setCheck] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const [year, month] = monthValue.split("-").map(Number);
  const isBlocked = check && check.unmarkedAttendance.length > 0;

  const handleMonthChange = (value) => {
    setMonthValue(value);
    setCheck(null);
    setError("");
    setSuccess("");
  };

  const handleCheck = async () => {
    setError("");
    setSuccess("");
    setIsChecking(true);
    try {
      setCheck(await adminApi.checkPayrollRun(year, month));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't check this month. Please try again."));
    } finally {
      setIsChecking(false);
    }
  };

  const handleRun = async () => {
    setError("");
    setSuccess("");
    setIsRunning(true);
    try {
      const response = await adminApi.runPayroll(year, month);
      const fileName = getFilenameFromResponse(response, `Payroll_${monthLabel(monthValue).replace(" ", "")}.zip`);
      downloadBlobAsFile(response.data, fileName);
      const generated = Number(response.headers?.["x-payroll-generated"]);
      const skipped = Number(response.headers?.["x-payroll-skipped"]);
      setSuccess(
        `Payroll for ${monthLabel(monthValue)} is done${generated ? ` - ${generated} payslip${generated === 1 ? "" : "s"} generated` : ""}. ${fileName} has been downloaded.${
          skipped ? ` ${skipped} employee${skipped === 1 ? " was" : "s were"} skipped - see "Skipped employees.txt" in the ZIP.` : ""
        }`
      );
      setCheck(null);
    } catch (err) {
      setError(await readBlobError(err, "Couldn't run payroll. Please try again."));
      // Re-check so the blocking list reflects what the server saw.
      adminApi.checkPayrollRun(year, month).then(setCheck).catch(() => {});
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal title="Run payroll" onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <p className="helper-text">
        Generates the payslip of every salaried employee for the chosen month and downloads them all as one ZIP file.
        Payslips already generated for that month keep the TDS and bonus entered on them; everyone else gets ₹0 for both.
      </p>

      <div className="field">
        <label className="field-label" htmlFor="run-payroll-month">
          Month
        </label>
        <div className="field-input-wrap">
          <MonthPicker id="run-payroll-month" value={monthValue} onChange={handleMonthChange} />
        </div>
      </div>

      {check && (
        <div style={{ marginTop: 8 }}>
          <p className="card-section-subtitle">
            <b>{check.employeeCount}</b> salaried employee{check.employeeCount === 1 ? "" : "s"} for {monthLabel(monthValue)}
            {check.alreadyGeneratedCount > 0 && <> · {check.alreadyGeneratedCount} already generated (will be regenerated)</>}
          </p>

          {isBlocked && (
            <Alert type="error">
              Payroll can&apos;t run yet - these employees have working days with no attendance marked (&quot;-&quot;). Mark
              their attendance, or record leave for those days, then check again.
            </Alert>
          )}
          {isBlocked && (
            <div className="data-table-wrap" style={{ marginBottom: 12 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Not marked</th>
                  </tr>
                </thead>
                <tbody>
                  {check.unmarkedAttendance.map((row) => (
                    <tr key={row.userId}>
                      <td className="table-cell-primary">
                        {row.employeeName}
                        {row.employeeCode && <span className="table-cell-secondary"> · {row.employeeCode}</span>}
                      </td>
                      <td className="table-cell-secondary">
                        {row.notMarkedDays.length} day{row.notMarkedDays.length === 1 ? "" : "s"}:{" "}
                        {row.notMarkedDays.map(formatDay).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {check.missingSalary.length > 0 && (
            <Alert type="info">
              No salary/CTC set - will be skipped: {check.missingSalary.map((u) => u.employeeName).join(", ")}
            </Alert>
          )}
        </div>
      )}

      <div className="modal-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        {check && !isBlocked ? (
          <Button type="button" onClick={handleRun} isLoading={isRunning} disabled={check.employeeCount === 0}>
            Run payroll &amp; download ZIP
          </Button>
        ) : (
          <Button type="button" onClick={handleCheck} isLoading={isChecking}>
            {check ? "Check again" : "Check"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
