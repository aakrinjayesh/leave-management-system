import { Check, Paperclip, X } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { formatDate } from "../../utils/formatDate";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fullName = (person) => (person ? `${person.firstName} ${person.lastName}` : null);

// "Who's handling / handled this" for one claim, from the claimant's point of
// view: pending → who it's with; approved / rejected → who decided it.
const decidedBy = (claim) => {
  if (claim.status === "APPROVED") return `Approved by ${fullName(claim.approvedBy) || "—"}`;
  if (claim.status === "REJECTED") return `Rejected by ${fullName(claim.approvedBy) || "—"}`;
  if (claim.status === "PENDING") {
    return fullName(claim.routedTo) ? `Pending with ${fullName(claim.routedTo)}` : "Pending with an admin";
  }
  return "—";
};

// Compact scan view. The description is truncated to one line here - the full
// text lives in the detail modal opened by clicking a row. Approvers also get
// inline Approve / Reject buttons on pending rows.
export default function ClaimsTable({ claims, showClaimant = false, onSelect, onApprove, onReject, actioningId = null }) {
  const canAct = Boolean(onApprove || onReject);

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {showClaimant && <th>Claimant</th>}
            <th>Subject</th>
            <th>Amount</th>
            <th>Files</th>
            <th>Status</th>
            <th>Decided by</th>
            <th>Submitted</th>
            <th>Reason / note</th>
            {canAct && <th></th>}
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="is-clickable" onClick={() => onSelect(claim)}>
              {showClaimant && (
                <td className="table-cell-primary">
                  {claim.user.firstName} {claim.user.lastName}
                  {claim.createdByManager && (
                    <span className="logged-by-manager-tag">
                      {claim.createdByAdmin ? "Logged by admin" : "Logged by manager"}
                    </span>
                  )}
                </td>
              )}
              <td className="table-cell-primary">
                {claim.subject}
                <div className="table-cell-secondary claim-desc-preview" style={{ fontWeight: 400 }}>
                  {claim.description}
                </div>
              </td>
              <td className="table-cell-primary" style={{ whiteSpace: "nowrap" }}>{money(claim.amount)}</td>
              <td className="table-cell-secondary" style={{ whiteSpace: "nowrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Paperclip size={13} />
                  {claim.attachments.length}
                </span>
              </td>
              <td><StatusBadge status={claim.status} /></td>
              <td className="table-cell-secondary">{decidedBy(claim)}</td>
              <td className="table-cell-secondary" style={{ whiteSpace: "nowrap" }}>{formatDate(claim.createdAt)}</td>
              <td className="table-cell-secondary claim-desc-preview">{claim.managerRemarks || "—"}</td>
              {canAct && (
                <td onClick={(e) => e.stopPropagation()}>
                  {claim.status === "PENDING" && (
                    <div className="row-actions">
                      {onApprove && (
                        <button
                          type="button"
                          className="row-action-btn approve"
                          disabled={actioningId === claim.id}
                          onClick={() => onApprove(claim)}
                        >
                          <Check size={14} />
                          Approve
                        </button>
                      )}
                      {onReject && (
                        <button
                          type="button"
                          className="row-action-btn reject"
                          disabled={actioningId === claim.id}
                          onClick={() => onReject(claim)}
                        >
                          <X size={14} />
                          Reject
                        </button>
                      )}
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
