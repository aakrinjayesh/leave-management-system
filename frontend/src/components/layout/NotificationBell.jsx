import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import * as notificationApi from "../../api/notification.api";
import { useAuth } from "../../context/AuthContext";
import { getNotificationDestination } from "../../utils/notificationLinks";
import "./NotificationBell.css";

const POLL_INTERVAL_MS = 30000;

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

  const refreshUnreadCount = () => notificationApi.getUnreadCount().then((data) => setUnreadCount(data.count));

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
    notificationApi.listMyNotifications().then((data) => setNotifications(data.notifications));
  };

  const handleToggle = () => (isOpen ? setIsOpen(false) : openPanel());

  const handleItemClick = (notification) => {
    if (!notification.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // Best-effort - a failed mark-as-read isn't worth surfacing an error for.
      notificationApi.markNotificationRead(notification.id).catch(() => {});
    }

    const destination = getNotificationDestination(notification.type, user);
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
