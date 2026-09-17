const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const notificationService = require("../services/notification.service");
const notificationStreamService = require("../services/notificationStream.service");

const SSE_KEEPALIVE_MS = 20000;

// Opens a long-lived connection and pushes a lightweight wake-up signal
// whenever this user gets a new notification (see notificationStream.service.js
// and notify()/notifyMany() in notification.service.js). Never calls
// res.end() itself - stays open until the client disconnects.
const streamNotifications = (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // Best-effort: tells an Nginx-style reverse proxy in front of this
    // service (if any) not to buffer the stream - harmless if there isn't one.
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  notificationStreamService.addConnection(req.user.id, res);

  // Without this, a quiet-but-healthy connection can look "idle" to the
  // browser, a proxy, or the hosting platform and get silently closed.
  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, SSE_KEEPALIVE_MS);

  req.on("close", () => {
    clearInterval(keepAlive);
    notificationStreamService.removeConnection(req.user.id, res);
  });
};

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

module.exports = { listMyNotifications, getUnreadCount, markRead, markAllRead, streamNotifications };
