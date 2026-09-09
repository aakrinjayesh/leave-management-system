import { useState } from "react";
import { Check, FileText, X } from "lucide-react";
import Modal from "../common/Modal";
import Button from "../common/Button";
import TextArea from "../common/TextArea";
import Alert from "../common/Alert";
import StatusBadge from "../common/StatusBadge";
import { formatDate } from "../../utils/formatDate";
import { getErrorMessage } from "../../utils/getErrorMessage";

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const longText = {
  whiteSpace: "pre-wrap",
  margin: "4px 0 0",
  lineHeight: 1.6,
  fontSize: "0.92rem",
};

// Full detail of one claim - the long description lives here in full rather
// than crammed into the table. Approvers (manager / admin) act from here; the
// claimant can cancel a pending one.
export default function ClaimDetailModal({ claim, currentUserId, api = {}, initialMode = "view", onClose, onChanged }) {
  const [mode, setMode] = useState(initialMode); // "view" | "reject"
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const isOwn = claim.user.id === currentUserId;
  const isPending = claim.status === "PENDING";
  const canDecide = isPending && !isOwn && (api.approve || api.reject);
  const canCancel = isPending && isOwn && api.cancel;

  const run = async (label, fn) => {
    setError("");
    setBusy(label);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
      setBusy("");
    }
  };

  const handleReject = (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setError("Please give a reason (at least 3 characters).");
      return;
    }
    run("reject", () => api.reject(claim.id, reason.trim()));
  };

  return (
    <Modal title={claim.subject} onClose={onClose} mid>
      <Alert type="error">{error}</Alert>

      <div className="profile-detail-grid">
        <div>
          <div className="profile-detail-label">Claimant</div>
          <div className="profile-detail-value">
            {claim.user.firstName} {claim.user.lastName}
            {claim.createdByManager && (
              <span className="logged-by-manager-tag">
                {claim.createdByAdmin ? "Logged by admin" : "Logged by manager"}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="profile-detail-label">Amount</div>
          <div className="profile-detail-value">{money(claim.amount)}</div>
        </div>
        <div>
          <div className="profile-detail-label">Status</div>
          <div className="profile-detail-value">
            <StatusBadge status={claim.status} />
          </div>
        </div>
        <div>
          <div className="profile-detail-label">Submitted</div>
          <div className="profile-detail-value">{formatDate(claim.createdAt)}</div>
        </div>
        {claim.approvedBy && claim.status !== "PENDING" && (
          <div>
            <div className="profile-detail-label">
              {claim.status === "APPROVED" ? "Approved by" : "Rejected by"}
            </div>
            <div className="profile-detail-value">
              {claim.approvedBy.firstName} {claim.approvedBy.lastName}
              {claim.approvedAt || claim.rejectedAt
                ? ` · ${formatDate(claim.approvedAt || claim.rejectedAt)}`
                : ""}
            </div>
          </div>
        )}
      </div>

      <div className="field" style={{ marginTop: 16 }}>
        <div className="profile-detail-label">Description</div>
        <p style={longText}>{claim.description}</p>
      </div>

      {claim.managerRemarks && (
        <div className="field">
          <div className="profile-detail-label">
            {claim.status === "REJECTED" ? "Reason for rejection" : "Note"}
          </div>
          <p style={longText}>{claim.managerRemarks}</p>
        </div>
      )}

      <div className="field">
        <div className="profile-detail-label">Attachments ({claim.attachments.length})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {claim.attachments.map((att) => (
            <a
              key={att.id}
              href={att.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="link-btn"
              style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <FileText size={14} />
              {att.fileName}
            </a>
          ))}
        </div>
      </div>

      {mode === "reject" ? (
        <form onSubmit={handleReject} noValidate>
          <TextArea
            label="Reason for rejection"
            placeholder="Let them know why this can't be approved"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Back
            </Button>
            <Button type="submit" isLoading={busy === "reject"}>
              Confirm rejection
            </Button>
          </div>
        </form>
      ) : (
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canCancel && (
            <Button
              type="button"
              variant="secondary"
              isLoading={busy === "cancel"}
              onClick={() => run("cancel", () => api.cancel(claim.id))}
            >
              Cancel claim
            </Button>
          )}
          {canDecide && api.reject && (
            <Button type="button" variant="secondary" onClick={() => setMode("reject")}>
              <X size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
              Reject
            </Button>
          )}
          {canDecide && api.approve && (
            <Button type="button" isLoading={busy === "approve"} onClick={() => run("approve", () => api.approve(claim.id))}>
              <Check size={14} style={{ marginRight: 5, verticalAlign: "-2px" }} />
              Approve
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
