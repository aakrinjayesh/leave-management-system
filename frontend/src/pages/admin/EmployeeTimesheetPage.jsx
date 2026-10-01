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
        fetchTimesheet={(view, date, projectId) => adminApi.getUserTimesheet(id, view, date, projectId)}
        exportTimesheet={(view, date, projectId) => adminApi.exportUserTimesheet(id, view, date, projectId)}
        downloadAttachment={(submissionId) => adminApi.downloadTimesheetSubmissionAttachment(submissionId)}
        decisionApi={{
          approve: (submissionId) => adminApi.approveTimesheetSubmission(submissionId),
          reject: (submissionId, remarks) => adminApi.rejectTimesheetSubmission(submissionId, remarks),
        }}
        logApi={{
          getPeriod: (employeeId, projectId, date) => adminApi.getTimesheetLogPeriod(employeeId, projectId, date),
          uploadAttachment: (employeeId, file) => adminApi.uploadTimesheetLogAttachment(employeeId, file),
          submit: (employeeId, payload) => adminApi.logTimesheetForEmployee(employeeId, payload),
        }}
        onDataLoad={setEmployee}
      />
    </DashboardLayout>
  );
}
