import { useEffect, useState } from "react";
import { CalendarDays, IdCard, Mail, Phone, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import * as profileApi from "../../api/profile.api";
import { formatDate } from "../../utils/formatDate";
import "./WelcomeBanner.css";

// Placeholder until there's a real "who do I contact for help" setting -
// hardcoded for now, swap for real data once that exists.
const SUPPORT_CONTACT = {
  name: "Krishna Dadi",
  email: "krishna.dadi@aakrin.com",
  phone: "+91 90000 00000",
};

const ROLE_LABELS = { MANAGER: "Manager", ADMIN: "Admin", EMPLOYEE: "Employee" };

const initialsOf = (name) =>
  name
    .split(" ")
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

      <div className="welcome-banner-assist">
        <span className="welcome-banner-assist-title">We're here to assist you</span>
        <div className="welcome-banner-assist-row">
          <span className="welcome-banner-assist-avatar" aria-hidden="true">
            {initialsOf(SUPPORT_CONTACT.name)}
          </span>
          <span className="welcome-banner-assist-name">{SUPPORT_CONTACT.name}</span>
        </div>
        <a className="welcome-banner-assist-link" href={`tel:${SUPPORT_CONTACT.phone}`}>
          <Phone size={13} />
          {SUPPORT_CONTACT.phone}
        </a>
        <a className="welcome-banner-assist-link" href={`mailto:${SUPPORT_CONTACT.email}`}>
          <Mail size={13} />
          {SUPPORT_CONTACT.email}
        </a>
      </div>
    </div>
  );
}
