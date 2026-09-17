import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Calendar from "../common/Calendar";
import Spinner from "../common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as managerLeaveApi from "../../api/managerLeave.api";

// Same calendar that used to live on its own "Team Calendar" tab (company
// holidays/weekends, plus every direct report's leave and WFH) - now reached
// from a button on the Team Attendance page instead of a separate sidebar
// item. Same pattern as CompanyCalendarModal (admin) and MyCalendarModal
// (personal).
export default function TeamCalendarModal({ onClose }) {
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

  const wfhEntries = (calendarData?.teamWfh || []).map((wfh) => ({
    startDate: wfh.startDate,
    endDate: wfh.endDate,
    label: `${wfh.user.firstName} · WFH`,
  }));

  return (
    <Modal title="Team calendar" onClose={onClose} wide>
      <p className="card-section-subtitle" style={{ marginTop: 0 }}>
        Company holidays, weekends, and who on your team is on leave. Read-only.
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
