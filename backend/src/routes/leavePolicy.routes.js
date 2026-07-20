const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { listLeavePolicies } = require("../controllers/leavePolicy.controller");

const router = express.Router();

router.get("/", authenticate, listLeavePolicies);

module.exports = router;
