import { useEffect, useState } from "react";
import Modal from "../../components/common/Modal";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";

export default function ProjectHistoryModal({ employee, onClose }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi
      .getProjectHistory(employee.id)
      .then((data) => setHistory(data.history))
      .catch((err) => setError(getErrorMessage(err, "Couldn't load this employee's project history.")));
  }, [employee.id]);

  return (
    <Modal title={`Project history — ${employee.firstName} ${employee.lastName}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>

      {!history ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Spinner size={24} />
        </div>
      ) : history.length === 0 ? (
        <p className="helper-text">No timesheet submissions with a project on file yet.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {history.map((stint, index) => (
                <tr key={`${stint.projectId}-${stint.startDate}-${index}`}>
                  <td className="table-cell-primary">
                    {stint.projectName || "—"}
                    {stint.isCurrent && <span className="logged-by-manager-tag">Current</span>}
                  </td>
                  <td className="table-cell-secondary">{formatDate(stint.startDate)}</td>
                  <td className="table-cell-secondary">
                    {stint.isCurrent ? "Present" : formatDate(stint.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
