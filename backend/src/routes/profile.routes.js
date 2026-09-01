const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  submitResignationSchema,
  updateMyPersonalInfoSchema,
  updateMyStatutoryInfoSchema,
  updateMyBankInfoSchema,
  updateMyIntroSchema,
} = require("../validators/profile.validator");
const controller = require("../controllers/profile.controller");
const { uploadProfileSectionDocuments } = require("../config/profileDocumentUpload");

const router = express.Router();

router.use(authenticate);

// multipart: text fields + optional document files. multer must run before
// validate so req.body is populated for validation.
router.patch(
  "/me/personal-info",
  uploadProfileSectionDocuments,
  validate(updateMyPersonalInfoSchema),
  controller.updateMyPersonalInfo
);
router.patch(
  "/me/statutory-info",
  uploadProfileSectionDocuments,
  validate(updateMyStatutoryInfoSchema),
  controller.updateMyStatutoryInfo
);
router.patch(
  "/me/bank-info",
  uploadProfileSectionDocuments,
  validate(updateMyBankInfoSchema),
  controller.updateMyBankInfo
);
router.get("/me/documents/:type", controller.getMyDocument);

router.get("/me/change-requests", controller.getMyProfileChangeRequests);

router.get("/me/intro", controller.getMyIntro);
router.put("/me/intro", validate(updateMyIntroSchema), controller.updateMyIntro);

router.put("/anniversary-celebration-seen", controller.markAnniversaryCelebrationSeen);
router.put("/birthday-celebration-seen", controller.markBirthdayCelebrationSeen);
router.get("/photo", controller.getMyPhoto);
router.get("/tax-computation", controller.getMyIncomeTaxComputation);
router.get("/tax-computation-generations", controller.listMyIncomeTaxComputationGenerations);
router.get("/tax-computation-generations/:id/pdf", controller.downloadMyIncomeTaxComputationPdf);

router.post("/resignation", validate(submitResignationSchema), controller.submitMyResignation);
router.get("/resignation", controller.getMyResignation);
router.patch("/resignation/:id/withdraw", controller.withdrawMyResignation);

module.exports = router;
