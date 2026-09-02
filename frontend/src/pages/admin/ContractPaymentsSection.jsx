import { useEffect, useState } from "react";
import { Calculator, Download, Eye, FileCheck2 } from "lucide-react";
import MonthPicker from "../../components/common/MonthPicker";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, getFilenameFromResponse, openBlobInNewTab } from "../../utils/openBlob";

const currentMonthValue = () => new Date().toISOString().slice(0, 7);
const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The "payslips page" surface for a hire-to-contract account: pick a month,
// preview Gross / TDS / Net, generate an immutable Contract Payslip with a
// downloadable PDF. Replaces the whole employee payslip + income-tax UI.
export default function ContractPaymentsSection({ userId, employeeName }) {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);

  const [year, month] = monthValue.split("-").map(Number);

  const loadHistory = () =>
    adminApi.listContractPayments(userId).then((data) => setHistory(data.payments));

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleCalculate = async () => {
    setError("");
    setSuccess("");
    setIsCalculating(true);
    try {
      const data = await adminApi.previewContractPayment(userId, year, month);
      setPreview(data.computed);
    } catch (err) {
      setPreview(null);
      setError(getErrorMessage(err, "Couldn't calculate this payment. Please try again."));
    } finally {
      setIsCalculating(false);
    }
  };

  const handleGenerate = async () => {
    setError("");
    setIsSaving(true);
    try {
      await adminApi.generateContractPayment(userId, { year, month });
      setSuccess(`Contract payslip for ${MONTH_LABELS[month - 1]} ${year} generated.`);
      setPreview(null);
      await loadHistory();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't generate this contract payslip. Please try again."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = async (payment) => {
    setDownloadingId(payment.id);
    try {
      const response = await adminApi.downloadContractPaymentPdf(payment.id);
      downloadBlobAsFile(
        response.data,
        getFilenameFromResponse(response, `contract-payslip-${payment.year}-${String(payment.month).padStart(2, "0")}.pdf`)
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this contract payslip."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (payment) => {
    setPreviewingId(payment.id);
    try {
      const response = await adminApi.downloadContractPaymentPdf(payment.id);
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this contract payslip."));
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <>
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Generate contract payslip</span>
          <p className="card-section-subtitle">
            {employeeName ? `${employeeName} is a hire-to-contract account. ` : ""}
            Gross Payment and TDS rate come from their details page. Net Payment = Gross Payment less TDS.
          </p>

          <div className="form-two-col">
            <div className="field">
              <label className="field-label" htmlFor="contract-payslip-month">
                Month
              </label>
              <div className="field-input-wrap">
                <MonthPicker
                  id="contract-payslip-month"
                  value={monthValue}
                  onChange={(newValue) => {
                    setMonthValue(newValue);
                    setPreview(null);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="modal-actions" style={{ justifyContent: "flex-start" }}>
            <Button variant="secondary" onClick={handleCalculate} isLoading={isCalculating}>
              <Calculator size={16} />
              Calculate
            </Button>
            {preview && (
              <Button onClick={handleGenerate} isLoading={isSaving}>
                <FileCheck2 size={16} />
                Generate &amp; save
              </Button>
            )}
          </div>

          {preview && (
            <div className="data-table-wrap" style={{ marginTop: 20 }}>
              <table className="data-table">
                <tbody>
                  <tr>
                    <td className="table-cell-primary">Gross Payment</td>
                    <td className="table-cell-secondary" style={{ textAlign: "right" }}>
                      {money(preview.grossPayment)}
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-primary">TDS @ {preview.tdsRatePercent}%</td>
                    <td className="table-cell-secondary" style={{ textAlign: "right" }}>
                      {money(preview.tdsAmount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="table-cell-primary">
                      <strong>Net Payment</strong>
                    </td>
                    <td className="table-cell-secondary" style={{ textAlign: "right" }}>
                      <strong>{money(preview.netPayment)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Contract payslip history</span>

          {!history ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Spinner size={24} />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <p>No contract payslips generated yet.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Gross Payment</th>
                    <th>TDS</th>
                    <th>Net Payment</th>
                    <th>Generated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((payment) => (
                    <tr key={payment.id}>
                      <td className="table-cell-primary">
                        {MONTH_LABELS[payment.month - 1]} {payment.year}
                      </td>
                      <td className="table-cell-secondary">{money(payment.grossPayment)}</td>
                      <td className="table-cell-secondary">
                        {payment.tdsRatePercent}% ({money(payment.tdsAmount)})
                      </td>
                      <td className="table-cell-secondary">{money(payment.netPayment)}</td>
                      <td className="table-cell-secondary">
                        {new Date(payment.generatedAt).toLocaleDateString("en-IN")}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={previewingId === payment.id}
                            onClick={() => handlePreview(payment)}
                          >
                            <Eye size={14} />
                            Preview
                          </button>
                          <button
                            type="button"
                            className="row-action-btn"
                            disabled={downloadingId === payment.id}
                            onClick={() => handleDownload(payment)}
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
    </>
  );
}
