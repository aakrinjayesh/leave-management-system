import { useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TimesheetDetailView from "../../components/timesheet/TimesheetDetailView";
import * as adminApi from "../../api/admin.api";
import "../../styles/dashboardShared.css";

export default function AdminEmployeeTimesheetPage() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);

  return (
    <DashboardLayout title="Timesheet">
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
