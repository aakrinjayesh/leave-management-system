const express = require("express");
const { authenticate, authorize, authorizeManager } = require("../middlewares/auth.middleware");
const controller = require("../controllers/attendance.controller");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

router.use(authenticate);

// Employee - self-reported, per project.
router.get("/me", controller.getMyAttendance);
router.post("/mark", controller.markAttendance);

// Manager - their direct reports only (isManager, derived from managerId).
router.get("/team", authorizeManager, controller.getTeamAttendance);

// Admin - everyone, plus the ability to correct a day.
router.get("/company", authorize(USER_TYPE.ADMIN), controller.getCompanyAttendance);
router.patch("/correct", authorize(USER_TYPE.ADMIN), controller.correctAttendance);

module.exports = router;
