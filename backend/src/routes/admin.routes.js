const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createUserSchema,
  updateManagerSchema,
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createHolidaySchema,
  updateHolidaySchema,
  updateUserDetailsSchema,
  updateSalaryStructureSchema,
  generatePayslipSchema,
  updateCompanySettingsSchema,
  customFieldSchema,
} = require("../validators/admin.validator");
const controller = require("../controllers/admin.controller");
const leaveController = require("../controllers/adminLeave.controller");
const payrollController = require("../controllers/adminPayroll.controller");
const employeeDocsController = require("../controllers/adminEmployeeDocs.controller");
const { uploadSingleEmployeeDocument } = require("../config/employeeDocumentUpload");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

router.use(authenticate, authorize(USER_TYPE.ADMIN));

router.get("/users", controller.listUsers);
router.post("/users", validate(createUserSchema), controller.createUser);
router.patch("/users/:id/manager", validate(updateManagerSchema), controller.updateUserManager);
router.patch("/users/:id/deactivate", controller.deactivateUser);
router.patch("/users/:id/reactivate", controller.reactivateUser);
router.get("/users/:id/timesheet", controller.getUserTimesheet);
router.get("/users/:id/timesheet/export", controller.exportUserTimesheet);
router.get("/timesheets/export", controller.exportPayrollTimesheet);
router.get("/users/:id/leaves", controller.getUserLeaveDetail);
router.get("/users/:id/calendar", controller.getUserCalendar);
router.get("/leave-requests/:id/attachment", controller.getUserLeaveAttachment);
router.get("/users/:id/details", controller.getUserDetails);
router.patch("/users/:id/details", validate(updateUserDetailsSchema), controller.updateUserDetails);

router.get("/leave-policies", leaveController.listLeavePolicies);
router.post("/leave-policies", validate(createLeavePolicySchema), leaveController.createLeavePolicy);
router.patch("/leave-policies/:id", validate(updateLeavePolicySchema), leaveController.updateLeavePolicy);
router.patch("/leave-policies/:id/deactivate", leaveController.deactivateLeavePolicy);
router.patch("/leave-policies/:id/reactivate", leaveController.reactivateLeavePolicy);

router.get("/holidays", leaveController.listHolidays);
router.post("/holidays", validate(createHolidaySchema), leaveController.createHoliday);
router.patch("/holidays/:id", validate(updateHolidaySchema), leaveController.updateHoliday);
router.patch("/holidays/:id/deactivate", leaveController.deactivateHoliday);
router.patch("/holidays/:id/reactivate", leaveController.reactivateHoliday);

router.get("/salary-structure", payrollController.getSalaryStructure);
router.put("/salary-structure", validate(updateSalaryStructureSchema), payrollController.updateSalaryStructure);
router.get("/users/:id/payslips/preview", payrollController.previewPayslip);
router.post("/users/:id/payslips", validate(generatePayslipSchema), payrollController.generatePayslip);
router.get("/users/:id/payslips", payrollController.listPayslips);
router.get("/payslips/:id/pdf", payrollController.downloadPayslipPdf);

router.get("/company-settings", controller.getCompanySettings);
router.put("/company-settings", validate(updateCompanySettingsSchema), controller.updateCompanySettings);

router.post(
  "/users/:id/documents/:type",
  uploadSingleEmployeeDocument,
  employeeDocsController.uploadUserDocument
);
router.delete("/users/:id/documents/:type", employeeDocsController.deleteUserDocument);
router.get("/users/:id/documents/:type", employeeDocsController.downloadUserDocument);

router.get("/users/:id/custom-fields", employeeDocsController.listCustomFields);
router.post(
  "/users/:id/custom-fields",
  uploadSingleEmployeeDocument,
  validate(customFieldSchema),
  employeeDocsController.createCustomField
);
router.patch(
  "/custom-fields/:fieldId",
  uploadSingleEmployeeDocument,
  validate(customFieldSchema),
  employeeDocsController.updateCustomField
);
router.delete("/custom-fields/:fieldId", employeeDocsController.deleteCustomField);
router.get("/custom-fields/:fieldId/document", employeeDocsController.downloadCustomFieldDocument);

module.exports = router;
