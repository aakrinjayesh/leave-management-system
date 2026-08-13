import axiosClient from "./axiosClient";

const unwrap = (promise) => promise.then((res) => res.data.data);

export const listMyNotifications = () => unwrap(axiosClient.get("/notifications"));

export const getUnreadCount = () => unwrap(axiosClient.get("/notifications/unread-count"));

export const markNotificationRead = (id) => unwrap(axiosClient.patch(`/notifications/${id}/read`));

export const markAllNotificationsRead = () => unwrap(axiosClient.patch("/notifications/read-all"));
