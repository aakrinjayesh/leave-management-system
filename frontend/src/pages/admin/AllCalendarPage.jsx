import { useEffect, useState } from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import Calendar from "../../components/common/Calendar";
import Spinner from "../../components/common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as adminApi from "../../api/admin.api";
import "../../styles/dashboardShared.css";

// Company-wide version of the manager team calendar - every non-admin
// employee's leave (pending + approved) and approved WFH on one calendar,
// with no reporting-line filter.
export default function AllCalendarPage() {
  const { year, month, goToPrevMonth, goToNextMonth } = useMonthNavigation();
  const [calendarData, setCalendarData] = useState(null);

  useEffect(() => {
    adminApi.getCompanyCalendar(year, month).then(setCalendarData);
  }, [year, month]);

  const leaveEntries = (calendarData?.teamLeaves || []).map((leave) => ({
    startDate: leave.startDate,
    endDate: leave.endDate,
    status: leave.status,
    label: `${leave.user.firstName} · ${leave.leavePolicy.leaveName}`,
  }));

  const wfhEntries = (calendarData?.teamWfh || []).map((wfh) => ({
    startDate: wfh.startDate,
    endDate: wfh.endDate,
    label: `${wfh.user.firstName} · WFH`,
  }));

  return (
    <DashboardLayout title="All calendar">
      <div className="page-header">
        <div>
          <h1>All calendar</h1>
          <p>Company holidays, weekends, and every employee's leave and WFH. Read-only.</p>
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
