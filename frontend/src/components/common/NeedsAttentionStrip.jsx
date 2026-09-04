import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import * as timesheetApi from "../../api/employeeTimesheet.api";
import * as attendanceApi from "../../api/attendance.api";
import { formatDateRange } from "../../utils/formatDate";
import "../../styles/dashboardShared.css";

// Slim "you have something to do" strip for the dashboard. Only renders when
// there's actually something outstanding - a timesheet that isn't submitted,
// or today's attendance not marked. Silent when the employee is caught up.
export default function NeedsAttentionStrip() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const now = new Date();

    Promise.allSettled([
      timesheetApi.getMyTimesheetStatus(),
      attendanceApi.getMyAttendance(now.getFullYear(), now.getMonth() + 1),
    ]).then(([tsRes, attRes]) => {
      if (!active) return;
      const next = [];

      if (tsRes.status === "fulfilled") {
        for (const p of tsRes.value.pending || []) {
          next.push({
            key: `ts-${p.projectId}`,
            to: "/timesheet",
            action: "Fill timesheet",
            text: p.rejected
              ? `Your timesheet for ${p.projectName} (${formatDateRange(p.periodStart, p.periodEnd)}) was rejected — resubmit it.`
              : `Your timesheet for ${p.projectName} (${formatDateRange(p.periodStart, p.periodEnd)}) isn't submitted.`,
          });
        }
      }

      if (attRes.status === "fulfilled") {
        const data = attRes.value;
        const today = data?.month?.days?.find((d) => d.date === data.todayKey) || null;
        const onProject = (data?.projects?.length ?? 0) > 0;
        if (onProject && today && today.markable) {
          const perProject = today.perProject || [];
          const marked = perProject.filter((x) => x.status === "PRESENT" || x.status === "HALF_DAY").length;
          if (perProject.length > 0 && marked < perProject.length) {
            next.push({
              key: "att-today",
              to: "/attendance",
              action: "Mark attendance",
              text: "You haven't marked yourself present today.",
            });
          }
        }
      }

      setItems(next);
    });

    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="needs-attention">
      {items.map((item) => (
        <div className="needs-attention-row" key={item.key}>
          <AlertTriangle size={15} className="needs-attention-icon" />
          <span className="needs-attention-text">{item.text}</span>
          <Link to={item.to} className="needs-attention-link">
            {item.action}
            <ArrowRight size={13} />
          </Link>
        </div>
      ))}
    </div>
  );
}
