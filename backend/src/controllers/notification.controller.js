const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const notificationService = require("../services/notification.service");

const listMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listForUser(req.user.id);
  new ApiResponse(200, "OK", { notifications }).send(res);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.countUnread(req.user.id);
  new ApiResponse(200, "OK", { count }).send(res);
});

const markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  await notificationService.markAsRead(req.user.id, id);
  new ApiResponse(200, "OK").send(res);
});

const markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  new ApiResponse(200, "OK").send(res);
});

module.exports = { listMyNotifications, getUnreadCount, markRead, markAllRead };
