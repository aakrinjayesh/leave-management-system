const express = require("express");
const { authenticate, authorizeManager } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createLeaveForEmployeeSchema, approveLeaveSchema, rejectLeaveSchema } = require("../validators/leave.validator");
const controller = require("../controllers/managerLeave.controller");
const resignationController = require("../controllers/managerResignation.controller");
const wfhController = require("../controllers/managerWfh.controller");

const router = express.Router();

// Access is based on isManager (derived from managerId assignments), not
// userType - any account with at least one direct report qualifies, ADMIN
// included.
router.use(authenticate, authorizeManager);

router.get("/overview", controller.getOverview);
router.get("/employees", controller.listEmployees);
router.get("/employees/:id", controller.getEmployeeDetail);
router.post(
  "/employees/:id/leave-requests",
  validate(createLeaveForEmployeeSchema),
  controller.createLeaveForEmployee
);
router.get("/leave-requests", controller.listTeamLeaveRequests);
router.get("/leave-requests/:id/attachment", controller.getTeamLeaveRequestAttachment);
router.patch("/leave-requests/:id/approve", validate(approveLeaveSchema), controller.approveLeaveRequest);
router.patch("/leave-requests/:id/reject", validate(rejectLeaveSchema), controller.rejectLeaveRequest);
router.get("/calendar", controller.getTeamCalendar);

router.get("/resignations", resignationController.listTeamResignations);
router.get("/wfh-requests", wfhController.listTeamWfhRequests);

module.exports = router;
