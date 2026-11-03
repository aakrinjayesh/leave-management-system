import { useState } from "react";
import Modal from "../common/Modal";
import Alert from "../common/Alert";
import * as attendanceApi from "../../api/attendance.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

// Shown when marking one day's attendance - a single Present / Half day /
// Clear control for the day, applied to every project the employee is on.
// Shared by the Attendance page (click a day) and the dashboard "today's
// attendance" widget.
export default function MarkAttendanceModal({ day, onClose, onSaved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // status being saved

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const isPresent = day.overall === "PRESENT";
  const isHalf = day.overall === "HALF_DAY";
  const marked = isPresent || isHalf;

  const set = async (status) => {
    setError("");
    setBusy(status);
    try {
      await attendanceApi.markAttendance({ date: day.date, status });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your attendance."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal title={`Mark attendance — ${dateLabel}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <div className="att-modal-projects">
        <div className="att-modal-project">
          <span className="att-modal-project-name">{marked ? (isPresent ? "Present" : "Half day") : "Not marked"}</span>
          <div className="att-toggle">
            <button
              type="button"
              className={`att-toggle-btn ${isPresent ? "is-on is-present" : ""}`}
              disabled={busy === "PRESENT"}
              onClick={() => set("PRESENT")}
            >
              Present
            </button>
            <button
              type="button"
              className={`att-toggle-btn ${isHalf ? "is-on is-half" : ""}`}
              disabled={busy === "HALF_DAY"}
              onClick={() => set("HALF_DAY")}
            >
              Half day
            </button>
            <button
              type="button"
              className="att-toggle-btn"
              disabled={!marked || busy === "CLEAR"}
              onClick={() => set("CLEAR")}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <p className="card-section-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
        Weren&apos;t working this day? Ask your manager or admin to record it as leave instead of leaving it unmarked.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary page-header-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
