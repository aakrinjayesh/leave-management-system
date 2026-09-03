import { useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TimesheetDetailView from "../../components/timesheet/TimesheetDetailView";
import * as managerTimesheetApi from "../../api/managerTimesheet.api";
import "../../styles/dashboardShared.css";

export default function EmployeeTimesheetPage() {
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
        fetchTimesheet={(view, date, projectId) => managerTimesheetApi.getEmployeeTimesheet(id, view, date, projectId)}
        exportTimesheet={(view, date, projectId) => managerTimesheetApi.exportEmployeeTimesheet(id, view, date, projectId)}
        downloadAttachment={(submissionId) => managerTimesheetApi.downloadSubmissionAttachment(submissionId)}
        logApi={{
          getPeriod: (employeeId, projectId, date) => managerTimesheetApi.getLogPeriod(employeeId, projectId, date),
          uploadAttachment: (employeeId, file) => managerTimesheetApi.uploadLogAttachment(employeeId, file),
          submit: (employeeId, payload) => managerTimesheetApi.logTimesheet(employeeId, payload),
        }}
        onDataLoad={setEmployee}
      />
    </DashboardLayout>
  );
}
