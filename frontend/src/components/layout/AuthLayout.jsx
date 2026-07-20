import { CalendarCheck2 } from "lucide-react";
import "./AuthLayout.css";

function BrandMark({ variant = "light" }) {
  return (
    <div className={variant === "light" ? "auth-brand-mark" : "auth-card-mobile-brand"}>
      <span className="auth-brand-mark-icon">
        <CalendarCheck2 size={20} />
      </span>
      Aakrin Leave
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-layout-brand">
        <BrandMark />
        <div className="auth-brand-copy">
          <h1>Manage time off, without the back-and-forth.</h1>
          <p>
            One place for your team to request, track and approve leave &mdash; built for
            Aakrin employees and managers.
          </p>
        </div>
        <div className="auth-brand-footer">&copy; {new Date().getFullYear()} Aakrin. All rights reserved.</div>
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
      </div>
    </div>
  );
}
