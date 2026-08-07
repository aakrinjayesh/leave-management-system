import { useEffect, useState } from "react";
import { FileWarning } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatusBadge from "../../components/common/StatusBadge";
import Spinner from "../../components/common/Spinner";
import Alert from "../../components/common/Alert";
import * as managerLeaveApi from "../../api/managerLeave.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import { formatDate } from "../../utils/formatDate";

export default function TeamResignationsPage() {
  const [resignations, setResignations] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    managerLeaveApi
      .getTeamResignations()
      .then((data) => setResignations(data.resignations))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  return (
    <DashboardLayout title="Resignations">
      <div className="page-header">
        <div>
          <h1>Resignations</h1>
          <p>Resignations submitted by your team - view only, admin manages acceptance.</p>
        </div>
      </div>

      <Alert type="error">{error}</Alert>

      <div className="card">
        <div className="card-section">
          {!resignations ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Spinner size={26} />
            </div>
          ) : resignations.length === 0 ? (
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
                    <th>Reason</th>
                    <th>Submitted on</th>
                    <th>Status</th>
                    <th>Last working day</th>
                  </tr>
                </thead>
                <tbody>
                  {resignations.map((resignation) => (
                    <tr key={resignation.id}>
                      <td className="table-cell-primary">
                        {resignation.user.firstName} {resignation.user.lastName}
                      </td>
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
