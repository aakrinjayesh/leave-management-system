import { useEffect, useState } from "react";
import { CalendarDays, Lock, LockOpen } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import AttendanceRoster from "../../components/attendance/AttendanceRoster";
import CompanyCalendarModal from "../../components/admin/CompanyCalendarModal";
import Button from "../../components/common/Button";
import * as attendanceApi from "../../api/attendance.api";
import * as adminApi from "../../api/admin.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

export default function AllAttendancePage() {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // null until loaded. true = employees may still edit previous months.
  const [allowPastEdits, setAllowPastEdits] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    adminApi
      .getCompanySettings()
      .then((data) => setAllowPastEdits(data.settings.allowPastMonthAttendanceEdits !== false))
      .catch(() => setAllowPastEdits(true));
  }, []);

  const togglePastEdits = async () => {
    const next = !allowPastEdits;
    setIsSaving(true);
    try {
      const data = await adminApi.updateCompanySettings({ allowPastMonthAttendanceEdits: next });
      setAllowPastEdits(data.settings.allowPastMonthAttendanceEdits);
    } catch (err) {
      window.alert(getErrorMessage(err, "Couldn't update the setting."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout title="All Attendance">
      <AttendanceRoster
        title="All attendance"
        subtitle={
          allowPastEdits === false
            ? "Daily attendance for every employee, per project. Click a day to correct it. Employees can only edit the current month."
            : "Daily attendance for every employee, per project. Click a day to correct it."
        }
        fetchData={attendanceApi.getCompanyAttendance}
        canCorrect
        correctFn={attendanceApi.correctAttendance}
        headerAction={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {allowPastEdits !== null && (
              <Button
                variant="secondary"
                isLoading={isSaving}
                onClick={togglePastEdits}
                className="page-header-btn"
              >
                {!isSaving && (allowPastEdits ? <Lock size={15} /> : <LockOpen size={15} />)}
                {allowPastEdits ? "Stop past-month edits" : "Allow past-month edits"}
              </Button>
            )}
            <button
              type="button"
              className="page-header-icon-btn"
              onClick={() => setIsCalendarOpen(true)}
              aria-label="Open company calendar"
              title="Company calendar"
            >
              <CalendarDays size={18} />
            </button>
          </div>
        }
      />

      {isCalendarOpen && <CompanyCalendarModal onClose={() => setIsCalendarOpen(false)} />}
    </DashboardLayout>
  );
}
