import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TimesheetDetailView from "../../components/timesheet/TimesheetDetailView";
import * as adminApi from "../../api/admin.api";
import "../../styles/dashboardShared.css";

export default function AdminEmployeeTimesheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);

  return (
    <DashboardLayout title="Timesheet">
      <button
        type="button"
        className="link-btn"
        style={{ marginBottom: 16 }}
        onClick={() => navigate("/admin/dashboard")}
      >
        <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Back to accounts
      </button>

      <div className="page-header">
        <div>
          <h1>{employee ? `${employee.firstName} ${employee.lastName}` : "Timesheet"}</h1>
          {employee && <p>{employee.email}</p>}
        </div>
      </div>

      <TimesheetDetailView
        key={id}
        fetchTimesheet={(view, date) => adminApi.getUserTimesheet(id, view, date)}
        exportTimesheet={(view, date) => adminApi.exportUserTimesheet(id, view, date)}
        downloadAttachment={(submissionId) => adminApi.downloadTimesheetSubmissionAttachment(submissionId)}
        onDataLoad={setEmployee}
      />
    </DashboardLayout>
  );
}
