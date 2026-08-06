import { useEffect, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import "./MonthPicker.css";

const MONTH_LABELS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_LABELS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parseValue = (value) => {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  return { year, month };
};

const currentYearMonth = () => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

// Custom month/year picker replacing the native <input type="month">, whose
// browser-rendered popup can't be styled to match the app's theme.
export default function MonthPicker({ id, value, onChange, placeholder = "Select month" }) {
  const selected = parseValue(value);
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || currentYearMonth()).year);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setViewYear((selected || currentYearMonth()).year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const selectMonth = (month) => {
    const padded = String(month).padStart(2, "0");
    onChange(`${viewYear}-${padded}`);
    setIsOpen(false);
  };

  const handleThisMonth = () => {
    const { year, month } = currentYearMonth();
    onChange(`${year}-${String(month).padStart(2, "0")}`);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const displayLabel = selected ? `${MONTH_LABELS_FULL[selected.month - 1]}, ${selected.year}` : "";

  return (
    <div className="month-picker" ref={containerRef}>
      <button
        type="button"
        id={id}
        className="field-input month-picker-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={displayLabel ? "" : "month-picker-placeholder"}>{displayLabel || placeholder}</span>
        <CalendarIcon size={16} className="month-picker-trigger-icon" />
      </button>

      {isOpen && (
        <div className="month-picker-panel">
          <div className="month-picker-year-row">
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="month-picker-year-label">{viewYear}</span>
            <button
              type="button"
              className="month-picker-nav-btn"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="month-picker-grid">
            {MONTH_LABELS_SHORT.map((label, index) => {
              const month = index + 1;
              const isSelected = selected && selected.year === viewYear && selected.month === month;
              const isCurrent = !isSelected && viewYear === currentYearMonth().year && month === currentYearMonth().month;
              return (
                <button
                  key={label}
                  type="button"
                  className={`month-picker-cell ${isSelected ? "is-selected" : ""} ${isCurrent ? "is-current" : ""}`.trim()}
                  onClick={() => selectMonth(month)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="month-picker-footer">
            <button type="button" className="month-picker-footer-link" onClick={handleClear}>
              Clear
            </button>
            <button type="button" className="month-picker-footer-link is-primary" onClick={handleThisMonth}>
              This month
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
