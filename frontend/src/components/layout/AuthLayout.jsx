import { CalendarDays, Clock, FileText, LogOut } from "lucide-react";
import aakrinLogo from "../../assets/aakrin-logo.png";
import { COPYRIGHT_TEXT } from "../../utils/copyright";
import "./AuthLayout.css";

function BrandMark({ variant = "light" }) {
  return (
    <div
      className={
        variant === "light" ? "auth-brand-mark" : "auth-card-mobile-brand"
      }
    >
      <img src={aakrinLogo} alt="Aakrin" className="auth-brand-mark-logo" />
      Employee Portal
    </div>
  );
}

const FEATURES = [
  { icon: CalendarDays, label: "Apply for, track and approve leave" },
  { icon: Clock, label: "Log timesheets and download payslips" },
  { icon: FileText, label: "Income tax computation and offer letters" },
  { icon: LogOut, label: "Submit and track resignations" },
];

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-layout">
      <div className="app-watermark auth-watermark" aria-hidden="true">
        <img src={aakrinLogo} alt="" />
      </div>
      <aside className="auth-layout-brand">
        <BrandMark />
        <div className="auth-brand-copy">
          <h1>Everything your workday needs, in one portal.</h1>
          <p>
            Built for Aakrin employees, managers and admins to handle it all in
            one place.
          </p>

          <span className="auth-feature-eyebrow">What you can do</span>
          <ul className="auth-feature-list">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label}>
                <Icon size={15} className="auth-feature-icon" />
                {label}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand-footer">{COPYRIGHT_TEXT}</div>
      </aside>

      <div className="auth-layout-form">
        <div className="auth-card">
          <BrandMark variant="mobile" />
          <div className="auth-card-header">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {children}
        </div>
        <footer className="auth-form-footer">{COPYRIGHT_TEXT}</footer>
      </div>
    </div>
  );
}
