const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { authenticateViaRefreshCookie } = require("../middlewares/sseAuth.middleware");
const controller = require("../controllers/notification.controller");

const router = express.Router();

// Registered before the blanket authenticate below - EventSource can't send
// the Bearer header every other route needs, so this one route checks the
// refresh-token cookie instead (see sseAuth.middleware.js).
router.get("/stream", authenticateViaRefreshCookie, controller.streamNotifications);

// Available to any authenticated account - notifications are per-user, not
// role-gated like most other route groups.
router.use(authenticate);

router.get("/", controller.listMyNotifications);
router.get("/unread-count", controller.getUnreadCount);
router.patch("/:id/read", controller.markRead);
router.patch("/read-all", controller.markAllRead);

module.exports = router;
