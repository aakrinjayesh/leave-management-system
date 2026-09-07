import { useNavigate } from "react-router-dom";
import { CalendarCheck, CalendarDays, Clock, Home } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/dashboardShared.css";

// Self-service for admins, surfaced on the dashboard rather than the sidebar
// (which is already crowded). Admins reach their own leave, timesheet, WFH and
// attendance here - same flows every other account uses. Their requests route
// to their assigned manager (if any) and are also actionable by another admin.
export default function MyWorkspaceSection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.userType !== "ADMIN") return null;

  const tiles = [
    {
      key: "leave-history",
      icon: <CalendarDays size={18} />,
      label: "My leave & requests",
      hint: "Balances and history",
      onClick: () => navigate("/employee/leave-requests"),
    },
    {
      key: "timesheet",
      icon: <Clock size={18} />,
      label: "My timesheet",
      hint: "Log and submit hours",
      onClick: () => navigate("/timesheet"),
    },
    {
      key: "wfh",
      icon: <Home size={18} />,
      label: "Work from home",
      hint: "Request WFH days",
      onClick: () => navigate("/wfh"),
    },
    {
      key: "attendance",
      icon: <CalendarCheck size={18} />,
      label: "My attendance",
      hint: "Mark yourself present",
      onClick: () => navigate("/attendance"),
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-section">
        <span className="card-section-title">My Workspace</span>
        <p className="card-section-subtitle">
          Your own leave, timesheet, WFH and attendance - same as any employee.
        </p>

        <div className="workspace-tile-grid">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              className="workspace-tile"
              onClick={tile.onClick}
            >
              <span className="workspace-tile-icon">{tile.icon}</span>
              <span className="workspace-tile-text">
                <span className="workspace-tile-label">{tile.label}</span>
                <span className="workspace-tile-hint">{tile.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
