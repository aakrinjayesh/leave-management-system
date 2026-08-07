import { useEffect, useState } from "react";
import { Check, FileWarning, X } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";

const FILTERS = [
  { label: "Pending", value: "PENDING" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Withdrawn", value: "WITHDRAWN" },
  { label: "All", value: "" },
];

export default function ResignationsPage() {
  const [filter, setFilter] = useState("PENDING");
  const [resignations, setResignations] = useState(null);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  const loadResignations = () =>
    adminApi
      .listResignations()
      .then((data) => setResignations(data.resignations))
      .catch((err) => setError(getErrorMessage(err)));

  useEffect(() => {
    loadResignations();
  }, []);

  const handleAccept = async (resignation) => {
    setError("");
    setActioningId(resignation.id);
    try {
      await adminApi.acceptResignation(resignation.id);
      await loadResignations();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't accept this resignation."));
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (resignation) => {
    setError("");
    setActioningId(resignation.id);
    try {
      await adminApi.rejectResignation(resignation.id);
      await loadResignations();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't reject this resignation."));
    } finally {
      setActioningId(null);
    }
  };

  const visible = resignations?.filter((r) => !filter || r.status === filter) || null;

  return (
    <DashboardLayout title="Resignations">
      <div className="page-header">
        <div>
          <h1>Resignations</h1>
          <p>Review resignation requests submitted by employees and accept or reject them.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

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
          {!visible ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <FileWarning size={22} />
              </span>
              <p>Nothing here.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Designation</th>
                    <th>Reason</th>
                    <th>Submitted on</th>
                    <th>Status</th>
                    <th>Last working day</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((resignation) => (
                    <tr key={resignation.id}>
                      <td className="table-cell-primary">
                        {resignation.user.firstName} {resignation.user.lastName}
                      </td>
                      <td className="table-cell-secondary">{resignation.user.designation || "—"}</td>
                      <td className="table-cell-secondary">{resignation.reason}</td>
                      <td className="table-cell-secondary">{formatDate(resignation.createdAt)}</td>
                      <td>
                        <StatusBadge status={resignation.status} />
                      </td>
                      <td>
                        {resignation.lastWorkingDate
                          ? formatDate(resignation.lastWorkingDate)
                          : `${formatDate(resignation.proposedLastWorkingDate)} (proposed)`}
                      </td>
                      <td>
                        {resignation.status === "PENDING" && (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="row-action-btn approve"
                              disabled={actioningId === resignation.id}
                              onClick={() => handleAccept(resignation)}
                            >
                              <Check size={14} />
                              Accept
                            </button>
                            <button
                              type="button"
                              className="row-action-btn reject"
                              disabled={actioningId === resignation.id}
                              onClick={() => handleReject(resignation)}
                            >
                              <X size={14} />
                              Reject
                            </button>
                          </div>
                        )}
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
