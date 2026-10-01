import { useEffect, useState } from "react";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import UpdateContractPaymentModal from "./UpdateContractPaymentModal";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const money = (value) =>
  `₹${(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatMonth = (date) =>
  new Date(date).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

// Replaces the "Salary" card on the Employee Details page for
// employmentType = CONTRACT accounts. Gross Payment - TDS = Net Payment, with
// its own effective-from history (Update adds a dated entry, Edit fixes the
// latest). Never rendered for employees or interns.
export default function ContractPaymentSection({ userId, onNotify }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const load = () =>
    adminApi
      .getContractPaymentStructureHistory(userId)
      .then((data) => setHistory(data.history))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load contract payment details.")));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const latest = history && history.length > 0 ? history[0] : null;
  const past = history ? history.slice(1) : [];

  const tdsAmount = latest ? (latest.grossPayment * latest.tdsRatePercent) / 100 : 0;

  const handleSaved = (message) => {
    setIsUpdateOpen(false);
    setIsEditOpen(false);
    load();
    onNotify?.(message);
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <span className="card-section-title">Contract payment</span>
          <p className="card-section-subtitle">
            This account is a hire-to-contract engagement. Payment is a flat Gross amount less TDS - no
            Basic/HRA/PF and no income-tax computation.
          </p>

          {error && <Alert type="error">{error}</Alert>}

          {history === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <Spinner size={22} />
            </div>
          ) : latest ? (
            <>
              <p className="card-section-subtitle">
                Effective from <strong>{formatMonth(latest.effectiveFrom)}</strong> onward
              </p>
              <div className="profile-detail-grid">
                <div>
                  <div className="profile-detail-label">Gross Payment</div>
                  <div className="profile-detail-value">{money(latest.grossPayment)}/month</div>
                </div>
                <div>
                  <div className="profile-detail-label">TDS</div>
                  <div className="profile-detail-value">
                    {latest.tdsRatePercent}% ({money(tdsAmount)})
                  </div>
                </div>
                <div>
                  <div className="profile-detail-label">Net Payment</div>
                  <div className="profile-detail-value">
                    <strong>{money(latest.grossPayment - tdsAmount)}</strong>/month
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="card-section-subtitle">No contract payment recorded yet for this account.</p>
          )}

          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <Button type="button" onClick={() => setIsUpdateOpen(true)}>
              Update Payment
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIsEditOpen(true)}>
              Edit Payment
            </Button>
          </div>
        </div>
      </div>

      {past.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-section">
            <span className="card-section-title">Past contract payments</span>
            <p className="card-section-subtitle">
              Earlier entries, most recent first - each was effective until the next one started.
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Effective from</th>
                    <th>Gross Payment</th>
                    <th>TDS rate</th>
                    <th>Net Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((entry) => {
                    const t = (entry.grossPayment * entry.tdsRatePercent) / 100;
                    return (
                      <tr key={entry.id}>
                        <td className="table-cell-primary">{formatMonth(entry.effectiveFrom)}</td>
                        <td className="table-cell-secondary">{money(entry.grossPayment)}</td>
                        <td className="table-cell-secondary">{entry.tdsRatePercent}%</td>
                        <td className="table-cell-secondary">{money(entry.grossPayment - t)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isUpdateOpen && (
        <UpdateContractPaymentModal
          userId={userId}
          onClose={() => setIsUpdateOpen(false)}
          onSuccess={() => handleSaved("Contract payment updated.")}
        />
      )}
      {isEditOpen && (
        <UpdateContractPaymentModal
          userId={userId}
          mode="edit"
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => handleSaved("Contract payment updated.")}
        />
      )}
    </>
  );
}
