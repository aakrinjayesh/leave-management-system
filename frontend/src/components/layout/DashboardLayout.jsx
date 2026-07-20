import {
  CalendarCheck2,
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
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./DashboardLayout.css";

const ROLE_LABELS = { MANAGER: "Manager", ADMIN: "Admin", EMPLOYEE: "Employee" };

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
    items.push({ to: "/employee/leave-requests", label: "My Requests", icon: ListChecks });
    items.push({ to: "/employee/calendar", label: "My Calendar", icon: CalendarDays });
    items.push({ to: "/timesheet", label: "Timesheet", icon: Clock });
  }

  if (user?.isManager) {
    items.push({ to: "/manager/employees", label: "Employees", icon: Users });
    items.push({ to: "/manager/leave-requests", label: "Leave Requests", icon: ListChecks });
    items.push({ to: "/manager/calendar", label: "Team Calendar", icon: CalendarDays });
    items.push({ to: "/manager/timesheets", label: "Team Timesheets", icon: Clock });
  }

  if (isAdmin) {
    items.push({ to: "/admin/dashboard", label: "Accounts", icon: ShieldCheck });
    items.push({ to: "/admin/manage-leaves", label: "Manage Leaves", icon: CalendarRange });
    items.push({ to: "/admin/payslips", label: "Payslips", icon: FileText });
  }
  items.push({ to: "/profile", label: "Profile", icon: UserCog });

  return items;
};

export default function DashboardLayout({ title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}`.toUpperCase();
  const roleLabel = ROLE_LABELS[user?.userType] || "Employee";
  const navItems = buildNavItems(user);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <span className="dashboard-brand-icon">
            <CalendarCheck2 size={18} />
          </span>
          Aakrin Leave
        </div>
        <nav className="dashboard-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `dashboard-nav-item ${isActive ? "active" : ""}`.trim()}
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <span className="dashboard-topbar-title">{title}</span>
          <div className="dashboard-user">
            <div className="dashboard-user-info">
              <div className="dashboard-user-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="dashboard-user-role">{roleLabel}</div>
            </div>
            <span className="dashboard-avatar">{initials || "?"}</span>
            <button className="dashboard-logout-btn" onClick={handleLogout} aria-label="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
