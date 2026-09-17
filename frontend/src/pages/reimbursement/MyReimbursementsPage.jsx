import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Receipt } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import ClaimsTable from "../../components/reimbursement/ClaimsTable";
import ClaimFormModal from "../../components/reimbursement/ClaimFormModal";
import ClaimDetailModal from "../../components/reimbursement/ClaimDetailModal";
import { useAuth } from "../../context/AuthContext";
import * as reimbursementApi from "../../api/reimbursement.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

export default function MyReimbursementsPage() {
  const { user } = useAuth();
  // A reimbursement decision/logged email's button lands here as
  // ?claimId=123 (after login) - auto-open that claim's detail modal.
  const [searchParams] = useSearchParams();
  const highlightClaimId = searchParams.get("claimId") ? Number(searchParams.get("claimId")) : null;
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const hasAutoOpenedRef = useRef(false);

  const load = () =>
    reimbursementApi
      .getMyClaims()
      .then((data) => {
        setClaims(data.claims);
        // Auto-open the deep-linked claim's detail modal once, right after
        // the first successful load - done here (inside the promise
        // callback) rather than in a useEffect keyed on `claims`, since
        // setState directly in an effect body triggers cascading renders.
        if (highlightClaimId && !hasAutoOpenedRef.current) {
          hasAutoOpenedRef.current = true;
          const match = data.claims.find((c) => c.id === highlightClaimId);
          if (match) setSelected(match);
          else setError("Couldn't find that reimbursement claim.");
        }
      })
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  return (
    <DashboardLayout title="Reimbursements">
      <div className="page-header">
        <div>
          <h1>Reimbursements</h1>
          <p>Claim back an expense. Attach the receipt or invoice &mdash; your manager or an admin will review it.</p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="page-header-btn btn-sm">
          <Plus size={16} />
          New claim
        </Button>
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="card">
        <div className="card-section">
          {!claims ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <Receipt size={22} />
              </span>
              <p>No reimbursement claims yet.</p>
            </div>
          ) : (
            <ClaimsTable claims={claims} onSelect={setSelected} />
          )}
        </div>
      </div>

      {isFormOpen && (
        <ClaimFormModal
          title="New reimbursement claim"
          onClose={() => setIsFormOpen(false)}
          submit={({ subject, description, amount, files }) =>
            reimbursementApi.submitClaim({ subject, description, amount, files })
          }
          onSubmitted={() => {
            setIsFormOpen(false);
            setSuccess("Claim submitted for approval.");
            load();
          }}
        />
      )}

      {selected && (
        <ClaimDetailModal
          claim={selected}
          currentUserId={user?.id}
          api={{ cancel: reimbursementApi.cancelClaim }}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            setSuccess("Claim cancelled.");
            load();
          }}
        />
      )}
    </DashboardLayout>
  );
}
