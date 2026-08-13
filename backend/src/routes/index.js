const express = require("express");
const authRoutes = require("./auth.routes");
const leavePolicyRoutes = require("./leavePolicy.routes");
const configRoutes = require("./config.routes");
const employeeLeaveRoutes = require("./employeeLeave.routes");
const managerLeaveRoutes = require("./managerLeave.routes");
const adminRoutes = require("./admin.routes");
const profileRoutes = require("./profile.routes");
const employeeTimesheetRoutes = require("./employeeTimesheet.routes");
const managerTimesheetRoutes = require("./managerTimesheet.routes");
const notificationRoutes = require("./notification.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/leave-policies", leavePolicyRoutes);
router.use("/config", configRoutes);
router.use("/employee/leave", employeeLeaveRoutes);
router.use("/manager", managerLeaveRoutes);
router.use("/admin", adminRoutes);
router.use("/profile", profileRoutes);
router.use("/employee/timesheet", employeeTimesheetRoutes);
router.use("/manager/timesheets", managerTimesheetRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;
