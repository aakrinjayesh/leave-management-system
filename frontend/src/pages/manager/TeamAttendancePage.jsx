import { useState } from "react";
import { CalendarDays } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import AttendanceRoster from "../../components/attendance/AttendanceRoster";
import TeamCalendarModal from "../../components/attendance/TeamCalendarModal";
import * as attendanceApi from "../../api/attendance.api";
import "../../styles/dashboardShared.css";

export default function TeamAttendancePage() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <DashboardLayout title="Team Attendance">
      <AttendanceRoster
        title="Team attendance"
        subtitle="Daily attendance for everyone who reports to you, per project. Read-only."
        fetchData={attendanceApi.getTeamAttendance}
        headerAction={
          <button
            type="button"
            className="page-header-icon-btn"
            onClick={() => setIsCalendarOpen(true)}
            aria-label="Open team calendar"
            title="Team calendar"
          >
            <CalendarDays size={18} />
          </button>
        }
      />

      {isCalendarOpen && <TeamCalendarModal onClose={() => setIsCalendarOpen(false)} />}
    </DashboardLayout>
  );
}
