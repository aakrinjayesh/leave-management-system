import { useEffect, useState } from "react";
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
import * as managerLeaveApi from "../../api/managerLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" },
];

export default function TeamReimbursementsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("PENDING");
  const [claims, setClaims] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(null); // { claim, mode }
  const [actioningId, setActioningId] = useState(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const load = () =>
    reimbursementApi
      .getTeamClaims(filter)
      .then((data) => setClaims(data.claims))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    managerLeaveApi.getEmployees().then((data) => setReports(data.employees)).catch(() => {});
  }, []);

  const handleApprove = async (claim) => {
    setError("");
    setSuccess("");
    setActioningId(claim.id);
    try {
      await reimbursementApi.managerApproveClaim(claim.id);
      setSuccess("Claim approved.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this claim."));
    } finally {
      setActioningId(null);
    }
  };

  const people = reports.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }));

  return (
    <DashboardLayout title="Team reimbursements">
      <div className="page-header">
        <div>
          <h1>Team reimbursements</h1>
          <p>Open a claim to see the full details and approve or reject it. Rejecting always needs a reason.</p>
        </div>
        {people.length > 0 && (
          <Button onClick={() => setIsLogOpen(true)} className="page-header-btn btn-sm">
            <Plus size={16} />
            Log a claim
          </Button>
        )}
      </div>

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>

      <div className="filter-tabs">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`filter-tab ${filter === f.value ? "active" : ""}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

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
              <p>Nothing here.</p>
            </div>
          ) : (
            <ClaimsTable
              claims={claims}
              showClaimant
              actioningId={actioningId}
              onSelect={(claim) => setSelected({ claim, mode: "view" })}
              onApprove={handleApprove}
              onReject={(claim) => setSelected({ claim, mode: "reject" })}
            />
          )}
        </div>
      </div>

      {selected && (
        <ClaimDetailModal
          claim={selected.claim}
          initialMode={selected.mode}
          currentUserId={user?.id}
          api={{ approve: reimbursementApi.managerApproveClaim, reject: reimbursementApi.managerRejectClaim }}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            setSuccess("Claim updated.");
            load();
          }}
        />
      )}

      {isLogOpen && (
        <ClaimFormModal
          title="Log a reimbursement claim"
          people={people}
          onClose={() => setIsLogOpen(false)}
          submit={({ personId, subject, description, amount, files }) =>
            reimbursementApi.logClaimForReport(personId, { subject, description, amount, files })
          }
          onSubmitted={() => {
            setIsLogOpen(false);
            setSuccess("Claim logged and approved.");
            load();
          }}
        />
      )}
    </DashboardLayout>
  );
}
