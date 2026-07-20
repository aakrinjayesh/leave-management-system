import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ListChecks } from "lucide-react";
import Spinner from "../common/Spinner";
import Alert from "../common/Alert";
import { formatDate, formatDateRange } from "../../utils/formatDate";
import { formatHoursMinutes } from "../../utils/formatDuration";
import { downloadBlobAsFile, getFilenameFromResponse } from "../../utils/openBlob";
import { getErrorMessage } from "../../utils/getErrorMessage";
import "../../styles/dashboardShared.css";

const toDateInputValue = (date) => new Date(date).toISOString().slice(0, 10);

const VIEWS = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

// Shared by the manager and admin "view one person's timesheet" pages - only
// difference between them is which API calls fetch/export the data, passed
// in as `fetchTimesheet(view, dateString) => Promise` and
// `exportTimesheet(view, dateString) => Promise<AxiosResponse>` (optional).
export default function TimesheetDetailView({ fetchTimesheet, exportTimesheet, onDataLoad }) {
  const [view, setView] = useState("week");
  const [anchorDate, setAnchorDate] = useState(toDateInputValue(new Date()));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchTimesheet(view, anchorDate).then((res) => {
      setData(res);
      if (onDataLoad) onDataLoad(res.employee);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDate]);

  const shiftAnchor = (direction) => {
    const date = new Date(anchorDate);
    if (view === "day") date.setUTCDate(date.getUTCDate() + direction);
    else if (view === "week") date.setUTCDate(date.getUTCDate() + direction * 7);
    else date.setUTCMonth(date.getUTCMonth() + direction);
    setAnchorDate(toDateInputValue(date));
  };

  const handleExport = async () => {
    setError("");
    setIsExporting(true);
    try {
      const response = await exportTimesheet(view, anchorDate);
      downloadBlobAsFile(response.data, getFilenameFromResponse(response, "timesheet.csv"));
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't export this timesheet."));
    } finally {
      setIsExporting(false);
    }
  };

  if (!data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <>
      <Alert type="error">{error}</Alert>

      <div className="section-flex-row">
        <div className="filter-tabs" style={{ marginBottom: 0 }}>
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              className={`filter-tab ${view === v.value ? "active" : ""}`}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>

        {exportTimesheet && (
          <button type="button" className="link-btn" onClick={handleExport} disabled={isExporting}>
            <Download size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {isExporting ? "Exporting…" : "Export CSV"}
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-section">
          <div className="section-flex-row">
            <button type="button" className="link-btn" onClick={() => shiftAnchor(-1)}>
              <ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Previous
            </button>
            <span className="card-section-title" style={{ marginBottom: 0 }}>
              {formatDateRange(data.rangeStart, data.rangeEnd)} — {formatHoursMinutes(data.totalHours)}
            </span>
            <button type="button" className="link-btn" onClick={() => shiftAnchor(1)}>
              Next <ChevronRight size={14} style={{ verticalAlign: "-2px" }} />
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-section">
          <span className="card-section-title">Entries</span>

          {data.entries.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">
                <ListChecks size={22} />
              </span>
              <p>No submitted entries in this range.</p>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="table-cell-primary">{formatDate(entry.date)}</td>
                      <td>{formatHoursMinutes(entry.hoursWorked)}</td>
                      <td className="table-cell-secondary">{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
