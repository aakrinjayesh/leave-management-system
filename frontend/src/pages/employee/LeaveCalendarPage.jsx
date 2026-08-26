import { useEffect, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Calendar from "../../components/common/Calendar";
import Spinner from "../../components/common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as employeeLeaveApi from "../../api/employeeLeave.api";
import "../../styles/dashboardShared.css";

export default function LeaveCalendarPage() {
  const { year, month, goToPrevMonth, goToNextMonth } = useMonthNavigation();
  const [calendarData, setCalendarData] = useState(null);

  useEffect(() => {
    employeeLeaveApi.getMyCalendar(year, month).then(setCalendarData);
  }, [year, month]);

  const leaveEntries = (calendarData?.myLeaves || []).map((leave) => ({
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: leave.status,
    label: leave.leavePolicy.leaveName,
  }));

  const wfhEntries = (calendarData?.myWfh || []).map((wfh) => ({
    startDate: wfh.startDate,
    endDate: wfh.endDate,
    label: "WFH",
  }));

  return (
    <DashboardLayout title="Calendar">
      <div className="page-header">
        <div>
          <h1>Calendar</h1>
          <p>Company holidays, weekends, and your own leave at a glance. Read-only.</p>
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
          wfhEntries={wfhEntries}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
        />
      )}
    </DashboardLayout>
  );
}
