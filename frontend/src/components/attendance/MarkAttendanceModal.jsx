import { useState } from "react";
import Modal from "../common/Modal";
import Alert from "../common/Alert";
import * as attendanceApi from "../../api/attendance.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

// Shown when marking one day's attendance - one row per project, each with
// Present / Half day / Absent. Shared by the Attendance page (click a day)
// and the dashboard "today's attendance" widget.
export default function MarkAttendanceModal({ day, onClose, onSaved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // `${projectId}|${action}`

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const set = async (projectId, status) => {
    setError("");
    setBusy(`${projectId}|${status}`);
    try {
      await attendanceApi.markAttendance({ projectId, date: day.date, status });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your attendance."));
      setBusy(null);
    }
  };

  return (
    <Modal title={`Mark attendance — ${dateLabel}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <div className="att-modal-projects">
        {day.perProject.map((p) => {
          const isPresent = p.status === "PRESENT";
          const isHalf = p.status === "HALF_DAY";
          const marked = isPresent || isHalf;
          return (
            <div className="att-modal-project" key={p.projectId}>
              <span className="att-modal-project-name">{p.projectName}</span>
              <div className="att-toggle">
                <button
                  type="button"
                  className={`att-toggle-btn ${isPresent ? "is-on is-present" : ""}`}
                  disabled={busy === `${p.projectId}|PRESENT`}
                  onClick={() => set(p.projectId, "PRESENT")}
                >
                  Present
                </button>
                <button
                  type="button"
                  className={`att-toggle-btn ${isHalf ? "is-on is-half" : ""}`}
                  disabled={busy === `${p.projectId}|HALF_DAY`}
                  onClick={() => set(p.projectId, "HALF_DAY")}
                >
                  Half day
                </button>
                <button
                  type="button"
                  className={`att-toggle-btn ${!marked ? "is-on is-absent" : ""}`}
                  disabled={busy === `${p.projectId}|ABSENT`}
                  onClick={() => set(p.projectId, "ABSENT")}
                >
                  Absent
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary page-header-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
