const express = require("express");
const { authenticate, authorizeManager } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { approveTimesheetSchema, rejectTimesheetSchema } = require("../validators/timesheet.validator");
const controller = require("../controllers/managerTimesheet.controller");

const router = express.Router();

// Same access rule as the rest of the manager-side API: isManager (derived
// from who's picked this account as their manager), not userType.
router.use(authenticate, authorizeManager);

router.get("/", controller.listTeamSubmissions);
router.get("/employees/:id", controller.getEmployeeTimesheet);
router.get("/employees/:id/export", controller.exportEmployeeTimesheet);
router.patch("/:id/approve", validate(approveTimesheetSchema), controller.approveSubmission);
router.patch("/:id/reject", validate(rejectTimesheetSchema), controller.rejectSubmission);

module.exports = router;
