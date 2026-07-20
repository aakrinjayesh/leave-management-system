import { useEffect, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Calendar from "../../components/common/Calendar";
import Spinner from "../../components/common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as managerLeaveApi from "../../api/managerLeave.api";
import "../../styles/dashboardShared.css";

export default function TeamCalendarPage() {
  const { year, month, goToPrevMonth, goToNextMonth } = useMonthNavigation();
  const [calendarData, setCalendarData] = useState(null);

  useEffect(() => {
    managerLeaveApi.getTeamCalendar(year, month).then(setCalendarData);
  }, [year, month]);

  const leaveEntries = (calendarData?.teamLeaves || []).map((leave) => ({
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: leave.status,
    label: `${leave.user.firstName} · ${leave.leavePolicy.leaveName}`,
  }));

  return (
    <DashboardLayout title="Team calendar">
      <div className="page-header">
        <div>
          <h1>Team calendar</h1>
          <p>Company holidays, weekends, and who on your team is on leave. Read-only.</p>
        </div>
      </div>

      {!calendarData ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <Calendar
          year={year}
          month={month}
          weekendDates={calendarData.weekendDates}
          holidays={calendarData.holidays}
          leaveEntries={leaveEntries}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />
      )}
    </DashboardLayout>
  );
}
