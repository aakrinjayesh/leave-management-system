const express = require("express");
const { authenticate, authorizeManager } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  approveTimesheetSchema,
  rejectTimesheetSchema,
  logTimesheetSchema,
} = require("../validators/timesheet.validator");
const { uploadSingleTimesheetAttachment } = require("../config/timesheetAttachmentUpload");
const controller = require("../controllers/managerTimesheet.controller");

const router = express.Router();

// Same access rule as the rest of the manager-side API: isManager (derived
// from who's picked this account as their manager), not userType.
router.use(authenticate, authorizeManager);

router.get("/", controller.listTeamSubmissions);
router.get("/employees/:id", controller.getEmployeeTimesheet);
router.get("/employees/:id/export", controller.exportEmployeeTimesheet);
router.get("/employees/:id/log-period", controller.getLogPeriod);
router.post("/employees/:id/log-attachment", uploadSingleTimesheetAttachment, controller.uploadLogAttachment);
router.post("/employees/:id/log", validate(logTimesheetSchema), controller.logTimesheet);
router.get("/submissions/:id/attachment", controller.getEmployeeTimesheetAttachment);
router.patch("/:id/approve", validate(approveTimesheetSchema), controller.approveSubmission);
router.patch("/:id/reject", validate(rejectTimesheetSchema), controller.rejectSubmission);

module.exports = router;
