import { useState } from "react";
import { CalendarDays } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import AttendanceRoster from "../../components/attendance/AttendanceRoster";
import CompanyCalendarModal from "../../components/admin/CompanyCalendarModal";
import * as attendanceApi from "../../api/attendance.api";
import "../../styles/dashboardShared.css";

export default function AllAttendancePage() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <DashboardLayout title="All Attendance">
      <AttendanceRoster
        title="All attendance"
        subtitle="Daily attendance for every employee, per project. Click a day to correct it."
        fetchData={attendanceApi.getCompanyAttendance}
        canCorrect
        correctFn={attendanceApi.correctAttendance}
        headerAction={
          <button
            type="button"
            className="page-header-icon-btn"
            onClick={() => setIsCalendarOpen(true)}
            aria-label="Open company calendar"
            title="Company calendar"
          >
            <CalendarDays size={18} />
          </button>
        }
      />

      {isCalendarOpen && <CompanyCalendarModal onClose={() => setIsCalendarOpen(false)} />}
    </DashboardLayout>
  );
}
