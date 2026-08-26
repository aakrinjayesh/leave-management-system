const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { submitWfhRequestSchema } = require("../validators/wfh.validator");
const controller = require("../controllers/employeeWfh.controller");

const router = express.Router();

router.use(authenticate);

router.post("/", validate(submitWfhRequestSchema), controller.submitMyWfhRequest);
router.get("/", controller.getMyWfhRequests);
router.patch("/:id/withdraw", controller.withdrawMyWfhRequest);

module.exports = router;
