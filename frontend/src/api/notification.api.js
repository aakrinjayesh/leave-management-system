import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

// EventSource needs a plain URL (not an axios call) - reuses whatever base
// path axiosClient resolved to (respects VITE_API_URL, defaults to "/api"),
// so this stays correct in both dev (Vite proxy) and prod.
export const getNotificationStreamUrl = () => `${axiosClient.defaults.baseURL}/notifications/stream`;

export const listMyNotifications = () => unwrap(axiosClient.get("/notifications"));

export const getUnreadCount = () => unwrap(axiosClient.get("/notifications/unread-count"));

export const markNotificationRead = (id) => unwrap(axiosClient.patch(`/notifications/${id}/read`));

export const markAllNotificationsRead = () => unwrap(axiosClient.patch("/notifications/read-all"));
