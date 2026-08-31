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

const router = express.Router();

router.use(authenticate);

router.patch("/me/personal-info", validate(updateMyPersonalInfoSchema), controller.updateMyPersonalInfo);
router.patch("/me/statutory-info", validate(updateMyStatutoryInfoSchema), controller.updateMyStatutoryInfo);
router.patch("/me/bank-info", validate(updateMyBankInfoSchema), controller.updateMyBankInfo);

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
