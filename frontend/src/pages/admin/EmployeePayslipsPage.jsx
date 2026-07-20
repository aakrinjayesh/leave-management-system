import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calculator, Download, Eye, FileCheck2 } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TextInput from "../../components/common/TextInput";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, getFilenameFromResponse, openBlobInNewTab } from "../../utils/openBlob";
import "../../styles/dashboardShared.css";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);
const money = (value) => `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const EARNING_ROWS = [
  ["Basic", "basic"],
  ["HRA", "hra"],
  ["LTA", "lta"],
  ["Conveyance", "conveyance"],
  ["Special Allowance", "specialAllowance"],
  ["Guaranteed Allowance", "guaranteedAllowance"],
  ["Annual Bonus Pay", "annualBonusPay"],
];

const DEDUCTION_ROWS = [
  ["Provident Fund", "pfEmployee"],
  ["Professional Tax", "professionalTax"],
  ["TDS", "tds"],
  [`Loss of Pay`, "lopAmount"],
];

export default function EmployeePayslipsPage() {
  const { id } = useParams();
  return <EmployeePayslipsContent key={id} id={id} />;
}

function EmployeePayslipsContent({ id }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [tds, setTds] = useState("0");
  const [annualBonusPay, setAnnualBonusPay] = useState("0");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);

  const loadHistory = () => adminApi.listPayslips(id).then((data) => setHistory(data.payslips));

  useEffect(() => {
    adminApi.getUserDetails(id).then((data) => setUser(data.user));
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [year, month] = monthValue.split("-").map(Number);

  const handleCalculate = async () => {
    setError("");
    setSuccess("");
    setIsCalculating(true);
    try {
      const data = await adminApi.previewPayslip(id, year, month, Number(tds) || 0, Number(annualBonusPay) || 0);
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(getErrorMessage(err, "Couldn't calculate this payslip. Please try again."));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleGenerate = async () => {
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await adminApi.generatePayslip(id, { year, month, tds: Number(tds) || 0, annualBonusPay: Number(annualBonusPay) || 0 });
      setSuccess(`Payslip for ${MONTH_LABELS[month - 1]} ${year} generated.`);
      loadHistory();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't generate this payslip. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (payslip) => {
    setDownloadingId(payslip.id);
    try {
      const response = await adminApi.downloadPayslipPdf(payslip.id);
      downloadBlobAsFile(
        response.data,
        getFilenameFromResponse(response, `payslip-${payslip.year}-${String(payslip.month).padStart(2, "0")}.pdf`)
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this payslip."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (payslip) => {
    setPreviewingId(payslip.id);
    try {
      const response = await adminApi.downloadPayslipPdf(payslip.id);
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this payslip."));
    } finally {
      setPreviewingId(null);
    }
  };

  if (!user) {
    return (
      <DashboardLayout title="Admin">
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin">
      <button type="button" className="link-btn" style={{ marginBottom: 16 }} onClick={() => navigate("/admin/payslips")}>
        <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Back to payslips
      </button>

      <div className="page-header">
        <div>
          <h1>
            {user.firstName} {user.lastName}
          </h1>
          <p>Generate a monthly payslip.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Generate payslip</span>

          <div className="form-two-col">
            <div className="field">
              <label className="field-label" htmlFor="payslip-month">
                Month
              </label>
              <div className="field-input-wrap">
                <input
                  id="payslip-month"
                  type="month"
                  className="field-input"
                  value={monthValue}
                  onChange={(e) => {
                    setMonthValue(e.target.value);
                    setPreview(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="form-two-col">
            <TextInput
              label="TDS (₹)"
              type="number"
              min="0"
              value={tds}
              onChange={(e) => {
                setTds(e.target.value);
                setPreview(null);
              }}
            />
            <TextInput
              label="Annual Bonus Pay (₹, optional)"
              type="number"
              min="0"
              value={annualBonusPay}
              onChange={(e) => {
                setAnnualBonusPay(e.target.value);
                setPreview(null);
              }}
            />
          </div>

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <Button variant="secondary" onClick={handleCalculate} isLoading={isCalculating}>
              <Calculator size={16} />
              Calculate
            </Button>
            {preview && (
              <Button onClick={handleGenerate} isLoading={isSaving}>
                <FileCheck2 size={16} />
                Generate &amp; save payslip
              </Button>
            )}
          </div>

          {preview && (
            <div style={{ marginTop: 20 }}>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Earnings</th>
                      <th>Amount</th>
                      <th>Deductions</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EARNING_ROWS.map(([label, field], i) => (
                      <tr key={field}>
                        <td className="table-cell-primary">{label}</td>
                        <td className="table-cell-secondary">{money(preview.computed[field])}</td>
                        <td className="table-cell-primary">{DEDUCTION_ROWS[i]?.[0] || ""}</td>
                        <td className="table-cell-secondary">
                          {DEDUCTION_ROWS[i] ? money(preview.computed[DEDUCTION_ROWS[i][1]]) : ""}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="table-cell-primary">PF Employer (informational)</td>
                      <td className="table-cell-secondary">{money(preview.computed.pfEmployer)}</td>
                      <td></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="balance-card-grid" style={{ marginTop: 16 }}>
                <div className="balance-card">
                  <div className="balance-card-name">Standard Days</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">{preview.computed.standardDays}</span>
                  </div>
                </div>
                <div className="balance-card">
                  <div className="balance-card-name">Days Worked</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">{preview.computed.daysWorked}</span>
                  </div>
                </div>
                <div className="balance-card">
                  <div className="balance-card-name">Gross Pay</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">{money(preview.computed.grossPay)}</span>
                  </div>
                </div>
                <div className="balance-card">
                  <div className="balance-card-name">Gross Deductions</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">{money(preview.computed.grossDeductions)}</span>
                  </div>
                </div>
                <div className="balance-card">
                  <div className="balance-card-name">Net Pay</div>
                  <div className="balance-card-numbers">
                    <span className="balance-card-remaining">{money(preview.computed.netPay)}</span>
                  </div>
                </div>
                {preview.computed.lopDays > 0 && (
                  <div className="balance-card">
                    <div className="balance-card-name">Loss of Pay days</div>
                    <div className="balance-card-numbers">
                      <span className="balance-card-remaining">{preview.computed.lopDays}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Payslip history</span>

          {!history ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Spinner size={24} />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <p>No payslips generated yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Gross Pay</th>
                    <th>Gross Deductions</th>
                    <th>Net Pay</th>
                    <th>Generated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((payslip) => (
                    <tr key={payslip.id}>
                      <td className="table-cell-primary">
                        {MONTH_LABELS[payslip.month - 1]} {payslip.year}
                      </td>
                      <td className="table-cell-secondary">{money(payslip.grossPay)}</td>
                      <td className="table-cell-secondary">{money(payslip.grossDeductions)}</td>
                      <td className="table-cell-secondary">{money(payslip.netPay)}</td>
                      <td className="table-cell-secondary">{new Date(payslip.generatedAt).toLocaleDateString("en-IN")}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={previewingId === payslip.id}
                            onClick={() => handlePreview(payslip)}
                          >
                            <Eye size={14} />
                            Preview
                          </button>
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={downloadingId === payslip.id}
                            onClick={() => handleDownload(payslip)}
                          >
                            <Download size={14} />
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
