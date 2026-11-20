import { useState } from "react";
import Modal from "../common/Modal";
import Alert from "../common/Alert";
import Spinner from "../common/Spinner";
import * as attendanceApi from "../../api/attendance.api";
import { getErrorMessage } from "../../utils/getErrorMessage";

const OPTIONS = [
  { status: "PRESENT", label: "Present", onCls: "is-present" },
  { status: "HALF_DAY", label: "Half day", onCls: "is-half" },
  { status: "ABSENT", label: "Absent", onCls: "is-absent" },
];

// Shown when marking one day's attendance - a single Present / Half day /
// Absent / Clear control for the day, applied to every project the employee is on.
// Shared by the Attendance page (click a day) and the dashboard "today's
// attendance" widget. Clicking an option saves it and closes the popup; the
// clicked button shows a spinner (and every button is locked) while it saves.
export default function MarkAttendanceModal({ day, onClose, onSaved }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // status being saved

  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const current = OPTIONS.find((o) => o.status === day.overall);
  const marked = Boolean(current);

  const set = async (status) => {
    if (busy) return;
    setError("");
    setBusy(status);
    try {
      await attendanceApi.markAttendance({ date: day.date, status });
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save your attendance."));
      setBusy(null);
    }
  };

  const renderButton = (status, label, className) => (
    <button
      key={status}
      type="button"
      className={`att-toggle-btn ${className}`}
      disabled={Boolean(busy) || (status === "CLEAR" && !marked)}
      onClick={() => set(status)}
    >
      {busy === status && <Spinner size={14} />}
      {label}
    </button>
  );

  return (
    <Modal title={`Mark attendance — ${dateLabel}`} onClose={onClose}>
      <Alert type="error">{error}</Alert>
      <div className="att-modal-projects">
        <div className="att-modal-project">
          <span className="att-modal-project-name">{current ? current.label : "Not marked"}</span>
          <div className="att-toggle">
            {OPTIONS.map((o) => renderButton(o.status, o.label, current?.status === o.status ? `is-on ${o.onCls}` : ""))}
            {renderButton("CLEAR", "Clear", "")}
          </div>
        </div>
      </div>
      <p className="card-section-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
        Weren&apos;t working this day? Mark it Absent rather than leaving it unmarked - unmarked days hold up payroll.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary page-header-btn" onClick={onClose} disabled={Boolean(busy)}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
