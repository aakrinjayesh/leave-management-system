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
  FileWarning,
  Home,
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
  }

  if (user?.isManager) {
    items.push({ to: "/manager/employees", label: "Employees", icon: Users });
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
      to: "/admin/manage-leaves",
      label: "Manage Leave Policy",
      icon: CalendarRange,
    });
    items.push({ to: "/admin/payslips", label: "Payslips", icon: FileText });
    items.push({
      to: "/admin/resignations",
      label: "Resignations",
      icon: FileWarning,
    });
    items.push({
      to: "/admin/wfh-requests",
      label: "WFH Requests",
      icon: Home,
    });
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
  const roleLabel = ROLE_LABELS[user?.userType] || "Employee";
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
