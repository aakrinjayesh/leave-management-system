import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import Button from "./Button";
import Spinner from "./Spinner";
import MarkAttendanceModal from "../attendance/MarkAttendanceModal";
import * as attendanceApi from "../../api/attendance.api";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

// Quick "mark me present today" widget for the dashboard - saves going to the
// Attendance tab and finding today. Opens the same MarkAttendanceModal the
// Attendance page uses (per-project Present / Half day / Absent).
export default function TodayAttendanceCard() {
  const now = new Date();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = () =>
    attendanceApi
      .getMyAttendance(now.getFullYear(), now.getMonth() + 1)
      .then(setData)
      .catch((err) => setError(getErrorMessage(err, "Couldn't load your attendance.")));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing to render until we know the person is on a project.
  if (!error && data && (data.projects?.length ?? 0) === 0) return null;

  const today = data?.month?.days?.find((d) => d.date === data.todayKey) || null;

  // Weekend / holiday / on-leave / future - the calendar itself wouldn't let
  // them mark it, so don't show a button either.
  if (data && (!today || !today.markable)) return null;

  const perProject = today?.perProject || [];
  const markedCount = perProject.filter((p) => p.status === "PRESENT" || p.status === "HALF_DAY").length;
  const total = perProject.length;
  const allMarked = total > 0 && markedCount === total;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <div className="section-flex-row" style={{ marginBottom: 4 }}>
          <span className="card-section-title" style={{ marginBottom: 0 }}>
            Today&apos;s attendance
          </span>
          <CalendarCheck size={16} style={{ color: "var(--text-secondary)" }} />
        </div>

        {error ? (
          <p className="intro-item-empty">{error}</p>
        ) : !data ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
            <Spinner size={18} />
          </div>
        ) : allMarked ? (
          <p className="card-section-subtitle" style={{ marginBottom: 0 }}>
            ✓ You&apos;ve marked attendance for today.{" "}
            <button type="button" className="link-btn" onClick={() => setOpen(true)}>
              Change
            </button>
          </p>
        ) : (
          <>
            <p className="card-section-subtitle">
              {markedCount > 0
                ? `${markedCount} of ${total} project${total === 1 ? "" : "s"} marked for today.`
                : "You haven't marked yourself present today."}
            </p>
            <Button className="page-header-btn" onClick={() => setOpen(true)}>
              <CalendarCheck size={16} />
              Mark today&apos;s attendance
            </Button>
          </>
        )}
      </div>

      {open && today && (
        <MarkAttendanceModal
          day={today}
          onClose={() => setOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
