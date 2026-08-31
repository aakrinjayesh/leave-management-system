import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import Button from "../../components/common/Button";
import Alert from "../../components/common/Alert";
import Spinner from "../../components/common/Spinner";
import TextArea from "../../components/common/TextArea";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";

const FIELD_LABELS = {
  phone: "Mobile number",
  birthDate: "Date of birth",
  gender: "Gender",
  maritalStatus: "Marital status",
  fatherName: "Father's name",
  fatherMotherPhone: "Father/Mother phone",
  spouseName: "Spouse name",
  nationality: "Nationality",
  qualification: "Qualification",
  pan: "PAN number",
  panHolderName: "Name as per PAN",
  uan: "UAN",
  aadharNumber: "Aadhaar number",
  aadharHolderName: "Name as per Aadhaar",
  bankAccountNumber: "Bank account number",
  bankName: "Bank name",
  ifscCode: "IFSC code",
};

const DATE_FIELDS = new Set(["birthDate"]);

const showValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (DATE_FIELDS.has(field)) return formatDate(value);
  return String(value);
};

// Admin review of an employee's pending self-service profile change requests -
// shown on the employee's details page. Renders nothing when there are none.
export default function ProfileChangeRequestsCard({ userId, onDecided }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = () =>
    adminApi
      .getProfileChangeRequests(userId)
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const pending = (requests || []).filter((request) => request.status === "PENDING");

  const handleAccept = async (id) => {
    setError("");
    setBusyId(id);
    try {
      await adminApi.acceptProfileChange(id);
      await load();
      onDecided?.();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't approve this change."));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setError("");
    setBusyId(id);
    try {
      await adminApi.rejectProfileChange(id, rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason("");
      await load();
      onDecided?.();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't reject this change."));
    } finally {
      setBusyId(null);
    }
  };

  // Nothing to review, and nothing loaded yet - stay out of the way.
  if (requests !== null && pending.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">Pending profile changes</span>
        <p className="card-section-subtitle">
          The employee submitted these edits from their own profile. Approve to apply them, or reject.
        </p>

        {error && <Alert type="error">{error}</Alert>}

        {requests === null ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <Spinner size={22} />
          </div>
        ) : (
          pending.map((request) => (
            <div key={request.id} className="pcr-request">
              <div className="pcr-request-head">
                <span className="pcr-request-section">{request.sectionLabel}</span>
                <span className="table-cell-secondary">Requested {formatDate(request.createdAt)}</span>
              </div>

              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Current</th>
                      <th>Requested</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.fields.map(({ field, current, requested }) => (
                      <tr key={field}>
                        <td className="table-cell-primary">{FIELD_LABELS[field] || field}</td>
                        <td className="table-cell-secondary">{showValue(field, current)}</td>
                        <td className="table-cell-primary">{showValue(field, requested)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rejectingId === request.id ? (
                <div className="pcr-reject-box">
                  <TextArea
                    rows={2}
                    placeholder="Reason for rejecting (optional) - the employee sees this."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <div className="row-actions" style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      className="page-header-btn"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      disabled={busyId === request.id}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="page-header-btn"
                      onClick={() => handleReject(request.id)}
                      isLoading={busyId === request.id}
                    >
                      Confirm reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="row-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="row-action-btn approve"
                    disabled={busyId === request.id}
                    onClick={() => handleAccept(request.id)}
                  >
                    <Check size={14} />
                    Approve &amp; apply
                  </button>
                  <button
                    type="button"
                    className="row-action-btn reject"
                    disabled={busyId === request.id}
                    onClick={() => {
                      setRejectingId(request.id);
                      setRejectReason("");
                    }}
                  >
                    <X size={14} />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
