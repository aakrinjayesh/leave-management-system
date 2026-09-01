import DashboardLayout from "../../components/layout/DashboardLayout";
import AttendanceRoster from "../../components/attendance/AttendanceRoster";
import * as attendanceApi from "../../api/attendance.api";
import "../../styles/dashboardShared.css";

export default function AllAttendancePage() {
  return (
    <DashboardLayout title="All Attendance">
      <AttendanceRoster
        title="All attendance"
        subtitle="Daily attendance for every employee, per project. Click a day to correct it."
        fetchData={attendanceApi.getCompanyAttendance}
        canCorrect
        correctFn={attendanceApi.correctAttendance}
      />
    </DashboardLayout>
  );
}
