import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import * as profileApi from "../../api/profile.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { downloadBlobAsFile, getFilenameFromResponse, openBlobInNewTab } from "../../utils/openBlob";

const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fyLabel = (year) => `FY ${year}-${String(year + 1).slice(-2)}`;
const REGIME_LABELS = { NEW: "New Regime", OLD: "Old Regime" };

// Read-only history of every Income Tax Computation Statement admin has
// generated for this employee - each one is a dated, frozen snapshot,
// downloadable as a PDF. Employees can view/download their own past
// generations but can't create new ones (only admin does that).
export default function MyIncomeTaxComputationHistory() {
  const [generations, setGenerations] = useState(null);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewingId, setPreviewingId] = useState(null);

  useEffect(() => {
    profileApi
      .listMyIncomeTaxComputationGenerations()
      .then((data) => setGenerations(data.generations))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your income tax computation history.")));
  }, []);

  const handleDownload = async (generation) => {
    setDownloadingId(generation.id);
    try {
      const response = await profileApi.downloadMyIncomeTaxComputationPdf(generation.id);
      downloadBlobAsFile(
        response.data,
        getFilenameFromResponse(response, `income-tax-computation-FY${generation.financialYear}.pdf`)
      );
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download this income tax computation."));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (generation) => {
    setPreviewingId(generation.id);
    try {
      const response = await profileApi.downloadMyIncomeTaxComputationPdf(generation.id);
      openBlobInNewTab(response.data);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't preview this income tax computation."));
    } finally {
      setPreviewingId(null);
    }
  };

  if (generations && generations.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Income Tax Computation Statements</span>
        <p className="card-section-subtitle">Official statements generated for you by admin - each one is dated.</p>

        <Alert type="error">{error}</Alert>

        {!generations ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
            <Spinner size={24} />
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Financial year</th>
                  <th>Regime</th>
                  <th>Status</th>
                  <th>Tax Payable/Refundable</th>
                  <th>Generated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {generations.map((generation) => (
                  <tr key={generation.id}>
                    <td className="table-cell-primary">{fyLabel(generation.financialYear)}</td>
                    <td className="table-cell-secondary">{REGIME_LABELS[generation.regime] || generation.regime}</td>
                    <td className="table-cell-secondary">{generation.mode === "FINAL" ? "Final" : "Projected"}</td>
                    <td className="table-cell-secondary">
                      {generation.taxPayable > 0
                        ? `${money(generation.taxPayable)} payable`
                        : generation.taxRefundable > 0
                          ? `${money(generation.taxRefundable)} refundable`
                          : "None"}
                    </td>
                    <td className="table-cell-secondary">
                      {new Date(generation.generatedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="row-action-btn"
                          disabled={previewingId === generation.id}
                          onClick={() => handlePreview(generation)}
                        >
                          <Eye size={14} />
                          Preview
                        </button>
                        <button
                          type="button"
                          className="row-action-btn"
                          disabled={downloadingId === generation.id}
                          onClick={() => handleDownload(generation)}
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
  );
}
