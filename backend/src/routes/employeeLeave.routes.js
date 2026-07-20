const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { applyLeaveSchema } = require("../validators/leave.validator");
const controller = require("../controllers/employeeLeave.controller");
const { USER_TYPE } = require("../utils/constants");
const { uploadSingleLeaveAttachment } = require("../config/upload");

const router = express.Router();

// These are "my own leave" routes - usable by employees and by Manager-tier
// accounts (Team Lead / HR / Manager), since they can also apply for leave up
// the hierarchy. Admin is excluded - it's the top of the chain, not a requester.
router.use(authenticate, authorize(USER_TYPE.EMPLOYEE, USER_TYPE.MANAGER));

router.get("/summary", controller.getDashboardSummary);
router.get("/balances", controller.getMyBalances);
router.get("/requests", controller.getMyLeaveRequests);
router.post("/requests", validate(applyLeaveSchema), controller.applyLeave);
router.post("/attachments", uploadSingleLeaveAttachment, controller.uploadAttachment);
router.get("/requests/:id/attachment", controller.getMyLeaveRequestAttachment);
router.patch("/requests/:id/cancel", controller.cancelLeaveRequest);
router.get("/calendar", controller.getMyCalendar);

module.exports = router;
