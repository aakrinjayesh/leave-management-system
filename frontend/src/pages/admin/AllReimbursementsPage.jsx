import { useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Search } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Button from "../../components/common/Button";
import TextInput from "../../components/common/TextInput";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import ClaimsTable from "../../components/reimbursement/ClaimsTable";
import ClaimFormModal from "../../components/reimbursement/ClaimFormModal";
import ClaimDetailModal from "../../components/reimbursement/ClaimDetailModal";
import { useAuth } from "../../context/AuthContext";
import * as reimbursementApi from "../../api/reimbursement.api";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "" },
];

export default function AllReimbursementsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState("PENDING");
  const [claims, setClaims] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState(null); // { claim, mode }
  const [actioningId, setActioningId] = useState(null);
  const [isLogOpen, setIsLogOpen] = useState(false);

  const load = () =>
    reimbursementApi
      .getAllClaims(filter)
      .then((data) => setClaims(data.claims))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    adminApi.listUsers().then((data) => setAccounts(data.users)).catch(() => {});
  }, []);

  const handleApprove = async (claim) => {
    setError("");
    setSuccess("");
    setActioningId(claim.id);
    try {
      await reimbursementApi.adminApproveClaim(claim.id);
      setSuccess("Claim approved.");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this claim."));
    } finally {
      setActioningId(null);
    }
  };

  const nameQuery = search.trim().toLowerCase();
  const visibleClaims = useMemo(() => {
    if (!claims) return [];
    if (!nameQuery) return claims;
    return claims.filter((c) => `${c.user.firstName} ${c.user.lastName}`.toLowerCase().includes(nameQuery));
  }, [claims, nameQuery]);

  const people = accounts
    .filter((a) => a.id !== user?.id && (a.status === "ACTIVE" || a.status === "PENDING"))
    .map((a) => ({ id: a.id, name: `${a.firstName} ${a.lastName}` }));

  return (
    <DashboardLayout title="All reimbursements">
      <div className="page-header">
        <div>
          <h1>All reimbursements</h1>
          <p>Every expense claim in the company. Open one to see the details and approve or reject it &mdash; rejecting needs a reason.</p>
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
          ) : (
            <>
              <div className="list-toolbar">
                <p className="table-caption">
                  {claims.length} claim{claims.length === 1 ? "" : "s"}
                </p>
                <div className="list-toolbar-search">
                  <TextInput
                    icon={<Search size={15} />}
                    placeholder="Search by name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {nameQuery && (
                    <span className="acct-search-count">
                      {visibleClaims.length} of {claims.length}
                    </span>
                  )}
                </div>
              </div>

              {visibleClaims.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-state-icon">
                    <Receipt size={22} />
                  </span>
                  <p>Nothing here.</p>
                </div>
              ) : (
                <ClaimsTable
                  claims={visibleClaims}
                  showClaimant
                  actioningId={actioningId}
                  onSelect={(claim) => setSelected({ claim, mode: "view" })}
                  onApprove={handleApprove}
                  onReject={(claim) => setSelected({ claim, mode: "reject" })}
                />
              )}
            </>
          )}
        </div>
      </div>

      {selected && (
        <ClaimDetailModal
          claim={selected.claim}
          initialMode={selected.mode}
          currentUserId={user?.id}
          api={{ approve: reimbursementApi.adminApproveClaim, reject: reimbursementApi.adminRejectClaim }}
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
            reimbursementApi.logClaimForUser(personId, { subject, description, amount, files })
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
