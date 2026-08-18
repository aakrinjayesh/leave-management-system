const express = require("express");
const { authenticate, authorize } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createUserSchema,
  updateManagerSchema,
  setAdminAccessSchema,
  createLeavePolicySchema,
  updateLeavePolicySchema,
  createHolidaySchema,
  updateHolidaySchema,
  updateUserDetailsSchema,
  generatePayslipSchema,
  updateCompanySettingsSchema,
  customFieldSchema,
  recordSalaryStructureSchema,
  recordExitSchema,
  taxDeclarationSchema,
  generateIncomeTaxComputationSchema,
  createProjectSchema,
  renameProjectSchema,
  createOfferLetterSchema,
  previewOfferLetterSchema,
} = require("../validators/admin.validator");
const controller = require("../controllers/admin.controller");
const leaveController = require("../controllers/adminLeave.controller");
const payrollController = require("../controllers/adminPayroll.controller");
const employeeDocsController = require("../controllers/adminEmployeeDocs.controller");
const exitController = require("../controllers/adminExit.controller");
const taxController = require("../controllers/adminTax.controller");
const reportController = require("../controllers/adminReport.controller");
const offerLetterController = require("../controllers/adminOfferLetter.controller");
const resignationController = require("../controllers/adminResignation.controller");
const { uploadSingleEmployeeDocument } = require("../config/employeeDocumentUpload");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

router.use(authenticate, authorize(USER_TYPE.ADMIN));

router.get("/users", controller.listUsers);
router.post("/users", validate(createUserSchema), controller.createUser);
router.patch("/users/:id/manager", validate(updateManagerSchema), controller.updateUserManager);
router.patch("/users/:id/admin-access", validate(setAdminAccessSchema), controller.setAdminAccess);
router.patch("/users/:id/reactivate", controller.reactivateUser);
router.patch("/users/:id/approve-signup", controller.approveSignup);
router.patch("/users/:id/reject-signup", controller.rejectSignup);
router.post("/users/:id/exit", validate(recordExitSchema), exitController.recordExit);
router.get("/users/:id/exit-records", exitController.listExitRecords);
router.get("/exit-records/:id/pdf", exitController.downloadRelievingLetterPdf);
router.post("/users/:id/offer-letters", validate(createOfferLetterSchema), offerLetterController.createOfferLetter);
router.get("/users/:id/offer-letters", offerLetterController.listOfferLetters);
router.post(
  "/users/:id/offer-letters/preview",
  validate(previewOfferLetterSchema),
  offerLetterController.previewOfferLetterPdf
);
router.get("/offer-letters/:id/pdf", offerLetterController.downloadOfferLetterPdf);
router.delete("/offer-letters/:id", offerLetterController.deleteOfferLetter);
router.get("/users/:id/timesheet", controller.getUserTimesheet);
router.get("/users/:id/timesheet/export", controller.exportUserTimesheet);
router.get("/timesheets/export", controller.exportPayrollTimesheet);
router.get("/timesheet-submissions/:id/attachment", controller.getTimesheetSubmissionAttachment);
router.get("/reports/project-assignment", reportController.getProjectAssignmentReport);
router.get("/users/:id/project-history", reportController.getProjectHistory);
router.get("/reports/timesheet-submissions", reportController.getWeekTimesheetSubmissions);
router.get("/projects", reportController.listProjects);
router.post("/projects", validate(createProjectSchema), reportController.createProject);
router.patch("/projects/:id", validate(renameProjectSchema), reportController.renameProject);
router.patch("/projects/:id/deactivate", reportController.deactivateProject);
router.patch("/projects/:id/reactivate", reportController.reactivateProject);
router.get("/users/:id/leaves", controller.getUserLeaveDetail);
router.get("/users/:id/calendar", controller.getUserCalendar);
router.get("/leave-requests/:id/attachment", controller.getUserLeaveAttachment);
router.get("/users/:id/details", controller.getUserDetails);
router.patch("/users/:id/details", validate(updateUserDetailsSchema), controller.updateUserDetails);

router.get("/leave-policies", leaveController.listLeavePolicies);
router.get("/leave-policies/history/years", leaveController.getLeavePolicyHistoryYears);
router.get("/leave-policies/history", leaveController.getLeavePolicyHistory);
router.post("/leave-policies", validate(createLeavePolicySchema), leaveController.createLeavePolicy);
router.patch("/leave-policies/:id", validate(updateLeavePolicySchema), leaveController.updateLeavePolicy);
router.patch("/leave-policies/:id/deactivate", leaveController.deactivateLeavePolicy);
router.patch("/leave-policies/:id/reactivate", leaveController.reactivateLeavePolicy);

router.get("/holidays", leaveController.listHolidays);
router.post("/holidays", validate(createHolidaySchema), leaveController.createHoliday);
router.patch("/holidays/:id", validate(updateHolidaySchema), leaveController.updateHoliday);
router.patch("/holidays/:id/deactivate", leaveController.deactivateHoliday);
router.patch("/holidays/:id/reactivate", leaveController.reactivateHoliday);

router.get("/users/:id/salary-structure-history", payrollController.getSalaryStructureHistory);
router.post(
  "/users/:id/salary-structure-history",
  validate(recordSalaryStructureSchema),
  payrollController.recordSalaryStructure
);
router.get("/users/:id/payslips/preview", payrollController.previewPayslip);
router.post("/users/:id/payslips", validate(generatePayslipSchema), payrollController.generatePayslip);
router.get("/users/:id/payslips", payrollController.listPayslips);
router.get("/payslips/:id/pdf", payrollController.downloadPayslipPdf);

router.get("/users/:id/tax-declaration", taxController.getTaxDeclaration);
router.put("/users/:id/tax-declaration", validate(taxDeclarationSchema), taxController.upsertTaxDeclaration);
router.get("/users/:id/tax-computation", taxController.getIncomeTaxComputation);

router.get("/users/:id/tax-computation-generations", taxController.listIncomeTaxComputationGenerations);
router.post(
  "/users/:id/tax-computation-generations",
  validate(generateIncomeTaxComputationSchema),
  taxController.generateIncomeTaxComputation
);
router.get("/tax-computation-generations/:id/pdf", taxController.downloadIncomeTaxComputationPdf);

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

router.get("/resignations", resignationController.listResignations);
router.patch("/resignations/:id/accept", resignationController.acceptResignation);
router.patch("/resignations/:id/reject", resignationController.rejectResignation);

module.exports = router;
