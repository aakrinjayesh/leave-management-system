const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { updateManagerSchema } = require("../validators/profile.validator");
const controller = require("../controllers/profile.controller");

const router = express.Router();

router.use(authenticate);

router.get("/manager-options", controller.getManagerOptions);
router.put("/manager", validate(updateManagerSchema), controller.updateMyManager);

module.exports = router;
