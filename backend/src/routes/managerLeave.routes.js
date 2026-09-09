const express = require("express");
const { authenticate, authorizeManager } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { createLeaveForEmployeeSchema, approveLeaveSchema, rejectLeaveSchema } = require("../validators/leave.validator");
const { rejectWfhRequestSchema } = require("../validators/wfh.validator");
const {
  logReimbursementForEmployeeSchema,
  approveReimbursementSchema,
  rejectReimbursementSchema,
} = require("../validators/reimbursement.validator");
const { uploadReimbursementAttachments } = require("../config/reimbursementAttachmentUpload");
const controller = require("../controllers/managerLeave.controller");
const resignationController = require("../controllers/managerResignation.controller");
const wfhController = require("../controllers/managerWfh.controller");
const reimbursementController = require("../controllers/managerReimbursement.controller");

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
router.patch("/wfh-requests/:id/approve", wfhController.approveWfhRequest);
router.patch("/wfh-requests/:id/reject", validate(rejectWfhRequestSchema), wfhController.rejectWfhRequest);

router.get("/reimbursements", reimbursementController.listTeam);
router.post(
  "/employees/:id/reimbursements",
  uploadReimbursementAttachments,
  validate(logReimbursementForEmployeeSchema),
  reimbursementController.logForEmployee
);
router.patch(
  "/reimbursements/:id/approve",
  validate(approveReimbursementSchema),
  reimbursementController.approve
);
router.patch(
  "/reimbursements/:id/reject",
  validate(rejectReimbursementSchema),
  reimbursementController.reject
);
router.get("/reimbursements/:id/attachments/:attachmentId", reimbursementController.getAttachment);

module.exports = router;
