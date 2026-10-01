import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import * as notificationApi from "../../api/notification.api";
import { useAuth } from "../../context/AuthContext";
import { getNotificationDestination } from "../../utils/notificationLinks";
import "./NotificationBell.css";

// Safety net only - the live SSE connection below normally keeps the badge
// current within moments of a notification being created. This just
// re-syncs occasionally in case that connection ever dies silently without
// the browser noticing (a dropped network path, etc).
const FALLBACK_POLL_INTERVAL_MS = 120000;

// Short "5m ago" / "3h ago" style label, falling back to a plain date once
// it's more than a day old - keeps the panel scannable without needing a
// full date on every row.
const formatRelativeTime = (dateString) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);
  // Mirrors `isOpen` for the SSE handler below, which is set up once on mount
  // - without this it would only ever see the initial isOpen value (stale
  // closure) instead of whether the panel is open at the moment a push arrives.
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const refreshUnreadCount = () => notificationApi.getUnreadCount().then((data) => setUnreadCount(data.count));

  const refreshList = () => notificationApi.listMyNotifications().then((data) => setNotifications(data.notifications));

  useEffect(() => {
    refreshUnreadCount();
    const fallbackInterval = setInterval(refreshUnreadCount, FALLBACK_POLL_INTERVAL_MS);

    // The server pushes a lightweight "something changed" signal the moment
    // any notification is created for this user (see notify()/notifyMany()
    // in the backend) - just re-fetch on receiving it rather than trying to
    // parse notification data out of the push itself, so the client always
    // ends up with complete, correct data straight from the REST endpoints.
    const source = new EventSource(notificationApi.getNotificationStreamUrl(), { withCredentials: true });
    source.onmessage = () => {
      refreshUnreadCount();
      if (isOpenRef.current) refreshList();
    };
    // EventSource reconnects on its own after an error; the fallback poll
    // above is what keeps the badge honest in the meantime.
    source.onerror = () => {};

    return () => {
      clearInterval(fallbackInterval);
      source.close();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const openPanel = () => {
    setIsOpen(true);
    refreshList();
  };

  const handleToggle = () => (isOpen ? setIsOpen(false) : openPanel());

  const handleItemClick = (notification) => {
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Best-effort - a failed mark-as-read isn't worth surfacing an error for.
      notificationApi.markNotificationRead(notification.id).catch(() => {});
    }

    // A per-notification link (set for record-specific alerts like a profile
    // change request) wins; otherwise fall back to the type + role lookup.
    const destination = notification.link || getNotificationDestination(notification.type, user);
    if (destination) {
      setIsOpen(false);
      navigate(destination);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev?.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationApi.markAllNotificationsRead();
    } catch {
      // Best-effort - a failed mark-as-read isn't worth surfacing an error for.
    }
  };

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-trigger"
        onClick={handleToggle}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notification-bell-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all-btn" onClick={handleMarkAllRead}>
                <CheckCheck size={13} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="notification-panel-list">
            {!notifications ? (
              <div className="notification-panel-empty">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="notification-panel-empty">You're all caught up.</div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-item ${notification.isRead ? "" : "is-unread"}`.trim()}
                  onClick={() => handleItemClick(notification)}
                >
                  <span className="notification-item-title">{notification.title}</span>
                  <span className="notification-item-message">{notification.message}</span>
                  <span className="notification-item-time">{formatRelativeTime(notification.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
