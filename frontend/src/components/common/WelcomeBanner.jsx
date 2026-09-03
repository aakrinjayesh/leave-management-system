import { useEffect, useState } from "react";
import { CalendarDays, IdCard, Mail, PartyPopper, Phone, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import * as profileApi from "../../api/profile.api";
import { formatDate } from "../../utils/formatDate";
import { formatTenureShort } from "../../utils/tenure";
import "./WelcomeBanner.css";

const ROLE_LABELS = { MANAGER: "Manager", ADMIN: "Admin", EMPLOYEE: "Employee" };

const greetingForNow = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const longToday = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const initialsOf = (name) =>
  (name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// Top-of-dashboard banner: a cover image + profile photo (both left empty
// for now - no upload feature exists yet, see WelcomeBanner.css for the
// placeholder styling) plus a "who to contact" card. Shared across all three
// dashboards (Employee/Manager/Admin).
export default function WelcomeBanner() {
  const { user } = useAuth();
  const roleLabel = ROLE_LABELS[user?.userType] || "Employee";
  const [photoUrl, setPhotoUrl] = useState(null);

  // "We're here to assist you" contact = this user's own manager, or the
  // primary admin if they have no manager (resolved server-side in the auth
  // payload). Null when it would resolve to the viewer themselves.
  const assist = user?.assistContact || null;
  const assistName = assist ? `${assist.firstName} ${assist.lastName}`.trim() : "";

  // Admin-uploaded (see Employee Details "Photo" field) - fetched through
  // the authenticated /profile/photo endpoint since there's no public URL
  // for it, then turned into a local object URL the <img> can use.
  useEffect(() => {
    if (!user?.hasPhoto) {
      setPhotoUrl(null);
      return undefined;
    }

    let objectUrl;
    profileApi
      .getMyPhoto()
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setPhotoUrl(objectUrl);
      })
      .catch(() => setPhotoUrl(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.hasPhoto]);

  return (
    <div className="card welcome-banner-card" style={{ marginBottom: 20 }}>
      <div className="welcome-banner-cover">
        <div className="welcome-banner-cover-glow" aria-hidden="true" />

        <div className="welcome-banner-greeting">
          <span className="welcome-banner-greeting-eyebrow">{greetingForNow()}</span>
          <span className="welcome-banner-greeting-main">
            Welcome back, {user?.firstName} <span aria-hidden="true">👋</span>
          </span>
          <span className="welcome-banner-greeting-date">{longToday()}</span>
        </div>

        {user?.joiningDate && (
          <div className="welcome-banner-tenure">
            <PartyPopper size={18} className="welcome-banner-tenure-icon" />
            <div className="welcome-banner-tenure-text">
              <span className="welcome-banner-tenure-eyebrow">With Aakrin for</span>
              <span className="welcome-banner-tenure-value">{formatTenureShort(user.joiningDate)}</span>
            </div>
          </div>
        )}

        <div className="welcome-banner-photo" aria-hidden="true">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="welcome-banner-photo-img" onError={() => setPhotoUrl(null)} />
          ) : (
            <User size={32} />
          )}
        </div>
        <div className="welcome-banner-identity">
          <span className="welcome-banner-name">
            {user?.firstName} {user?.lastName}
          </span>
          <span className="welcome-banner-role">
            {user?.designation && <span>{user.designation}</span>}
            {user?.designation && <span className="welcome-banner-role-dot">•</span>}
            <span>{roleLabel}</span>
          </span>
          <div className="welcome-banner-meta">
            {user?.email && (
              <span className="welcome-banner-meta-item">
                <Mail size={12} />
                {user.email}
              </span>
            )}
            {user?.employeeCode && (
              <span className="welcome-banner-meta-item">
                <IdCard size={12} />
                {user.employeeCode}
              </span>
            )}
            {user?.joiningDate && (
              <span className="welcome-banner-meta-item">
                <CalendarDays size={12} />
                Joined {formatDate(user.joiningDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {assist && (assistName || assist.email || assist.phone) && (
        <div className="welcome-banner-assist">
          <span className="welcome-banner-assist-title">We're here to assist you</span>
          {assistName && (
            <div className="welcome-banner-assist-row">
              <span className="welcome-banner-assist-avatar" aria-hidden="true">
                {initialsOf(assistName)}
              </span>
              <span className="welcome-banner-assist-name">{assistName}</span>
            </div>
          )}
          {assist.phone && (
            <a className="welcome-banner-assist-link" href={`tel:${assist.phone}`}>
              <Phone size={13} />
              {assist.phone}
            </a>
          )}
          {assist.email && (
            <a className="welcome-banner-assist-link" href={`mailto:${assist.email}`}>
              <Mail size={13} />
              {assist.email}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
