const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { submitResignationSchema } = require("../validators/profile.validator");
const controller = require("../controllers/profile.controller");

const router = express.Router();

router.use(authenticate);

router.put("/anniversary-celebration-seen", controller.markAnniversaryCelebrationSeen);
router.put("/birthday-celebration-seen", controller.markBirthdayCelebrationSeen);
router.get("/tax-computation", controller.getMyIncomeTaxComputation);
router.get("/tax-computation-generations", controller.listMyIncomeTaxComputationGenerations);
router.get("/tax-computation-generations/:id/pdf", controller.downloadMyIncomeTaxComputationPdf);

router.post("/resignation", validate(submitResignationSchema), controller.submitMyResignation);
router.get("/resignation", controller.getMyResignation);
router.patch("/resignation/:id/withdraw", controller.withdrawMyResignation);

module.exports = router;
