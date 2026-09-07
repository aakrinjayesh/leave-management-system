const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { applyLeaveSchema } = require("../validators/leave.validator");
const controller = require("../controllers/employeeLeave.controller");
const { USER_TYPE } = require("../utils/constants");
const { uploadSingleLeaveAttachment } = require("../config/upload");

const router = express.Router();

// These are "my own leave" routes - usable by every account type. Employees and
// Manager-tier accounts apply up the hierarchy; Admin can also apply for their
// own leave (routed to their assigned manager if they have one, and always
// actionable by another admin - see applyLeave / adminLeave.controller).
router.use(authenticate, authorize(USER_TYPE.EMPLOYEE, USER_TYPE.MANAGER, USER_TYPE.ADMIN));

router.get("/summary", controller.getDashboardSummary);
router.get("/balances", controller.getMyBalances);
router.get("/requests", controller.getMyLeaveRequests);
router.post("/requests", validate(applyLeaveSchema), controller.applyLeave);
router.post("/attachments", uploadSingleLeaveAttachment, controller.uploadAttachment);
router.get("/requests/:id/attachment", controller.getMyLeaveRequestAttachment);
router.patch("/requests/:id/cancel", controller.cancelLeaveRequest);
router.get("/calendar", controller.getMyCalendar);

module.exports = router;
