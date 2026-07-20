import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import TimesheetDetailView from "../../components/timesheet/TimesheetDetailView";
import * as managerTimesheetApi from "../../api/managerTimesheet.api";
import "../../styles/dashboardShared.css";

export default function EmployeeTimesheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);

  return (
    <DashboardLayout title="Timesheet">
      <button
        type="button"
        className="link-btn"
        style={{ marginBottom: 16 }}
        onClick={() => navigate(`/manager/employees/${id}`)}
      >
        <ArrowLeft size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
        Back to employee
      </button>

      <div className="page-header">
        <div>
          <h1>{employee ? `${employee.firstName} ${employee.lastName}` : "Timesheet"}</h1>
          {employee && <p>{employee.email}</p>}
        </div>
      </div>

      <TimesheetDetailView
        key={id}
        fetchTimesheet={(view, date) => managerTimesheetApi.getEmployeeTimesheet(id, view, date)}
        exportTimesheet={(view, date) => managerTimesheetApi.exportEmployeeTimesheet(id, view, date)}
        onDataLoad={setEmployee}
      />
    </DashboardLayout>
  );
}
