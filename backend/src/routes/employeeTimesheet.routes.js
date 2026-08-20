const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { saveEntrySchema, submitWeekSchema } = require("../validators/timesheet.validator");
const { uploadSingleTimesheetAttachment } = require("../config/timesheetAttachmentUpload");
const controller = require("../controllers/employeeTimesheet.controller");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

// Same population as "my own leave" - Admin sits at the top of the chain and
// doesn't log a timesheet itself.
router.use(authenticate, authorize(USER_TYPE.EMPLOYEE, USER_TYPE.MANAGER));

router.get("/entries", controller.getMyEntries);
router.post("/entries", validate(saveEntrySchema), controller.saveEntry);
router.delete("/entries/:id", controller.deleteEntry);

router.post("/attachment", uploadSingleTimesheetAttachment, controller.uploadAttachment);

router.post("/submissions", validate(submitWeekSchema), controller.submitWeek);
router.get("/submissions", controller.listMySubmissions);
router.get("/submissions/:id/attachment", controller.getSubmissionAttachment);

module.exports = router;
