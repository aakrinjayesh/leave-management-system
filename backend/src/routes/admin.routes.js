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
  contractPaymentStructureSchema,
  generateContractPaymentSchema,
  updateCompanySettingsSchema,
  customFieldSchema,
  recordSalaryStructureSchema,
  recordExitSchema,
  taxDeclarationSchema,
  generateIncomeTaxComputationSchema,
  createProjectSchema,
  renameProjectSchema,
  setProjectMembersSchema,
  createOfferLetterSchema,
  previewOfferLetterSchema,
  rejectProfileChangeSchema,
} = require("../validators/admin.validator");
const { rejectWfhRequestSchema } = require("../validators/wfh.validator");
const { approveLeaveSchema, rejectLeaveSchema } = require("../validators/leave.validator");
const { approveTimesheetSchema, rejectTimesheetSchema } = require("../validators/timesheet.validator");
const controller = require("../controllers/admin.controller");
const leaveController = require("../controllers/adminLeave.controller");
const payrollController = require("../controllers/adminPayroll.controller");
const employeeDocsController = require("../controllers/adminEmployeeDocs.controller");
const exitController = require("../controllers/adminExit.controller");
const taxController = require("../controllers/adminTax.controller");
const reportController = require("../controllers/adminReport.controller");
const offerLetterController = require("../controllers/adminOfferLetter.controller");
const resignationController = require("../controllers/adminResignation.controller");
const wfhController = require("../controllers/adminWfh.controller");
const profileChangeController = require("../controllers/adminProfileChange.controller");
const contractPaymentController = require("../controllers/adminContractPayment.controller");
const { uploadSingleEmployeeDocument } = require("../config/employeeDocumentUpload");
const { USER_TYPE } = require("../utils/constants");

const router = express.Router();

router.use(authenticate, authorize(USER_TYPE.ADMIN));

router.get("/users", controller.listUsers);
router.post("/users", validate(createUserSchema), controller.createUser);
router.patch("/users/:id/manager", validate(updateManagerSchema), controller.updateUserManager);
router.patch("/users/:id/admin-access", validate(setAdminAccessSchema), controller.setAdminAccess);
router.patch("/users/:id/reactivate", controller.reactivateUser);
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
router.get("/timesheet-summary", controller.listEmployeeTimesheetSummary);
router.get("/timesheets/export", controller.exportPayrollTimesheet);
router.patch("/timesheets/:id/approve", validate(approveTimesheetSchema), controller.approveTimesheetSubmission);
router.patch("/timesheets/:id/reject", validate(rejectTimesheetSchema), controller.rejectTimesheetSubmission);
router.get("/timesheet-submissions/:id/attachment", controller.getTimesheetSubmissionAttachment);
router.get("/reports/project-assignment", reportController.getProjectAssignmentReport);
router.get("/users/:id/project-history", reportController.getProjectHistory);
router.get("/reports/timesheet-submissions", reportController.getWeekTimesheetSubmissions);
router.get("/projects", reportController.listProjects);
router.post("/projects", validate(createProjectSchema), reportController.createProject);
router.patch("/projects/:id", validate(renameProjectSchema), reportController.renameProject);
router.patch("/projects/:id/members", validate(setProjectMembersSchema), reportController.setProjectMembers);
router.get("/projects/:id/recent-members", reportController.getProjectRecentMembers);
router.patch("/projects/:id/deactivate", reportController.deactivateProject);
router.patch("/projects/:id/reactivate", reportController.reactivateProject);
router.get("/users/:id/leaves", controller.getUserLeaveDetail);
router.get("/users/:id/calendar", controller.getUserCalendar);
router.get("/calendar", controller.getCompanyCalendar);
router.get("/leave-summary", leaveController.listEmployeeLeaveSummary);
router.patch("/leave-requests/:id/approve", validate(approveLeaveSchema), leaveController.approveLeaveRequest);
router.patch("/leave-requests/:id/reject", validate(rejectLeaveSchema), leaveController.rejectLeaveRequest);
router.get("/leave-requests/:id/attachment", controller.getUserLeaveAttachment);
router.get("/users/:id/details", controller.getUserDetails);
router.patch("/users/:id/details", validate(updateUserDetailsSchema), controller.updateUserDetails);
router.get("/users/:id/profile-change-requests", profileChangeController.listForUser);
router.patch("/profile-change-requests/:id/accept", profileChangeController.accept);
router.patch("/profile-change-requests/:id/reject", validate(rejectProfileChangeSchema), profileChangeController.reject);

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
router.patch(
  "/users/:id/salary-structure-history/latest",
  validate(recordSalaryStructureSchema),
  payrollController.updateLatestSalaryStructure
);
router.get("/users/:id/payslips/preview", payrollController.previewPayslip);
router.post("/users/:id/payslips", validate(generatePayslipSchema), payrollController.generatePayslip);
router.get("/users/:id/payslips", payrollController.listPayslips);
router.get("/payslips/:id/pdf", payrollController.downloadPayslipPdf);

// Contract-hire payment (employmentType = CONTRACT) - fully separate from the
// employee salary structure / payslips above.
router.get("/users/:id/contract-payment-structure-history", contractPaymentController.getStructureHistory);
router.post(
  "/users/:id/contract-payment-structure-history",
  validate(contractPaymentStructureSchema),
  contractPaymentController.recordStructure
);
router.patch(
  "/users/:id/contract-payment-structure-history/latest",
  validate(contractPaymentStructureSchema),
  contractPaymentController.updateLatestStructure
);
router.get("/users/:id/contract-payments/preview", contractPaymentController.previewPayment);
router.post(
  "/users/:id/contract-payments",
  validate(generateContractPaymentSchema),
  contractPaymentController.generatePayment
);
router.get("/users/:id/contract-payments", contractPaymentController.listPayments);
router.get("/contract-payments/:id/pdf", contractPaymentController.downloadPaymentPdf);

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

router.get("/wfh-requests", wfhController.listWfhRequests);
router.patch("/wfh-requests/:id/approve", wfhController.approveWfhRequest);
router.patch("/wfh-requests/:id/reject", validate(rejectWfhRequestSchema), wfhController.rejectWfhRequest);

module.exports = router;
