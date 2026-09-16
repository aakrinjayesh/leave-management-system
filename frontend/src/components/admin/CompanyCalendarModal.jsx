import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import Calendar from "../common/Calendar";
import Spinner from "../common/Spinner";
import { useMonthNavigation } from "../../hooks/useMonthNavigation";
import * as adminApi from "../../api/admin.api";

// Same company-wide calendar that used to live on its own "All Calendar" tab
// (every employee's leave + WFH, plus holidays/weekends) - now reached from a
// button on the All Attendance page instead of a separate sidebar item.
export default function CompanyCalendarModal({ onClose }) {
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
    <Modal title="All calendar" onClose={onClose} full>
      <div className="calendar-modal-body">
        <p className="card-section-subtitle" style={{ marginTop: 0 }}>
          Company holidays, weekends, and every employee's leave and WFH. Read-only.
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
      </div>
    </Modal>
  );
}
