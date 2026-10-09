const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const controller = require("../controllers/notification.controller");

const router = express.Router();

// The live SSE stream is registered in auth.routes.js as
// /auth/notification-stream - it authenticates off the refresh-token
// cookie, which is only sent to /api/auth paths.

// Available to any authenticated account - notifications are per-user, not
// role-gated like most other route groups.
router.use(authenticate);

router.get("/", controller.listMyNotifications);
router.get("/unread-count", controller.getUnreadCount);
router.patch("/:id/read", controller.markRead);
router.patch("/read-all", controller.markAllRead);

module.exports = router;
