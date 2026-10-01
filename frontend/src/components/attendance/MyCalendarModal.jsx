import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Calendar from "../common/Calendar";
import Spinner from "../common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as employeeLeaveApi from "../../api/employeeLeave.api";

// Same calendar that used to live on its own "My Calendar" tab (your own
// leave + WFH, plus company holidays/weekends) - now reached from a button
// on the Attendance page instead of a separate sidebar item. Same pattern as
// CompanyCalendarModal for admin's All Attendance page.
export default function MyCalendarModal({ onClose }) {
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
    <Modal title="My calendar" onClose={onClose} wide>
      <p className="card-section-subtitle" style={{ marginTop: 0 }}>
        Company holidays, weekends, and your own leave at a glance. Read-only.
      </p>

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
    </Modal>
  );
}
