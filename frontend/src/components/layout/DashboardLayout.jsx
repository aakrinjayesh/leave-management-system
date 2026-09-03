import {
  ArrowLeft,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Users,
  CalendarDays,
  ShieldCheck,
  UserCog,
  Clock,
  CalendarRange,
  FileText,
  BarChart3,
  Table2,
  FileWarning,
  Home,
  CalendarCheck,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useBackNavigation } from "../../hooks/useBackNavigation";
import NotificationBell from "./NotificationBell";
import aakrinLogo from "../../assets/aakrin-logo.png";
import { COPYRIGHT_TEXT } from "../../utils/copyright";
import "./DashboardLayout.css";

const ROLE_LABELS = {
  MANAGER: "Manager",
  ADMIN: "Admin",
  EMPLOYEE: "Employee",
};

// Employment type is a label that overrides the role label in the top-right
// corner (interns/contractors are still EMPLOYEE userType under the hood).
const EMPLOYMENT_TYPE_LABELS = {
  INTERN: "Intern",
  CONTRACT: "Contract",
};

// Nav is driven by isManager (derived: does anyone currently report to this
// account) rather than userType, so it stays correct as employees pick and
// change their own manager.
const buildNavItems = (user) => {
  const isAdmin = user?.userType === "ADMIN";
  const items = [];

  items.push({
    to: user?.isManager ? "/manager/dashboard" : "/employee/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  });

  if (isAdmin) {
    items.push({
      to: "/admin/leave-requests",
      label: "All Leave Requests",
      icon: ListChecks,
    });
    items.push({
      to: "/admin/timesheets",
      label: "All Timesheets",
      icon: Clock,
    });
    items.push({
      to: "/admin/calendar",
      label: "All Calendar",
      icon: CalendarDays,
    });
    items.push({
      to: "/admin/attendance",
      label: "All Attendance",
      icon: CalendarCheck,
    });
    items.push({
      to: "/admin/wfh-requests",
      label: "All WFH Requests",
      icon: Home,
    });
    items.push({
      to: "/admin/resignations",
      label: "All Resignations",
      icon: FileWarning,
    });
  }

  if (!isAdmin) {
    items.push({
      to: "/employee/leave-requests",
      label: "My Leave Requests",
      icon: ListChecks,
    });
    items.push({
      to: "/employee/calendar",
      label: "My Calendar",
      icon: CalendarDays,
    });
    items.push({ to: "/timesheet", label: "Timesheet", icon: Clock });
    items.push({ to: "/wfh", label: "WFH", icon: Home });
    items.push({ to: "/attendance", label: "Attendance", icon: CalendarCheck });
  }

  if (user?.isManager && !isAdmin) {
    // Admin doesn't get the manager tabs at all: the team roster + team-scoped
    // Leave Requests / Calendar / Timesheets are replaced by the company-wide
    // "All ..." tabs added right after Dashboard above, and Team WFH / Team
    // Resignations were view-only mirrors of the admin's own WFH / Resignations
    // pages (also promoted up top).
    items.push({ to: "/manager/employees", label: "Employees", icon: Users });
    items.push({
      to: "/manager/attendance",
      label: "Team Attendance",
      icon: CalendarCheck,
    });
    items.push({
      to: "/manager/leave-requests",
      label: "Leave Requests",
      icon: ListChecks,
    });
    items.push({
      to: "/manager/calendar",
      label: "Team Calendar",
      icon: CalendarDays,
    });
    items.push({
      to: "/manager/timesheets",
      label: "Team Timesheets",
      icon: Clock,
    });
    items.push({
      to: "/manager/resignations",
      label: "Team Resignations",
      icon: FileWarning,
    });
    items.push({
      to: "/manager/wfh-requests",
      label: "Team WFH",
      icon: Home,
    });
  }

  if (isAdmin) {
    items.push({
      to: "/admin/dashboard",
      label: "Manage Accounts",
      icon: ShieldCheck,
    });
    items.push({
      to: "/admin/reports",
      label: "Project",
      icon: BarChart3,
    });
    items.push({
      to: "/admin/report",
      label: "Report",
      icon: Table2,
    });
    items.push({
      to: "/admin/manage-leaves",
      label: "Manage Leave Policy",
      icon: CalendarRange,
    });
    items.push({ to: "/admin/payslips", label: "Payslips", icon: FileText });
  }
  items.push({ to: "/profile", label: "Profile", icon: UserCog });

  return items;
};

export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { canGoBack, goBack } = useBackNavigation();

  const initials =
    `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const roleLabel =
    EMPLOYMENT_TYPE_LABELS[user?.employmentType] || ROLE_LABELS[user?.userType] || "Employee";
  const navItems = buildNavItems(user);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard-shell">
      <div className="app-watermark dashboard-watermark" aria-hidden="true">
        <img src={aakrinLogo} alt="" />
      </div>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <img
            src={aakrinLogo}
            alt="Aakrin"
            style={{ width: 62, height: 62, objectFit: "contain" }}
          />
          <span>
            Employee
            <br />
            Portal
          </span>
        </div>
        <nav className="dashboard-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `dashboard-nav-item ${isActive ? "active" : ""}`.trim()
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button
              type="button"
              className="dashboard-back-btn"
              onClick={goBack}
              disabled={!canGoBack}
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="dashboard-topbar-title">{title}</span>
          </div>
          <div className="dashboard-user">
            <NotificationBell />
            <div className="dashboard-user-info">
              <div className="dashboard-user-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="dashboard-user-role">{roleLabel}</div>
            </div>
            <span className="dashboard-avatar">{initials || "?"}</span>
            <button
              className="dashboard-logout-btn"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
        <footer className="dashboard-footer">{COPYRIGHT_TEXT}</footer>
      </div>
    </div>
  );
}
