import DashboardLayout from "../../components/layout/DashboardLayout";
import AttendanceRoster from "../../components/attendance/AttendanceRoster";
import * as attendanceApi from "../../api/attendance.api";
import "../../styles/dashboardShared.css";

export default function TeamAttendancePage() {
  return (
    <DashboardLayout title="Team Attendance">
      <AttendanceRoster
        title="Team attendance"
        subtitle="Daily attendance for everyone who reports to you, per project. Read-only."
        fetchData={attendanceApi.getTeamAttendance}
      />
    </DashboardLayout>
  );
}
