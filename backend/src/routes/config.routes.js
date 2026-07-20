const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { getConfig } = require("../controllers/config.controller");

const router = express.Router();

router.get("/", authenticate, getConfig);

module.exports = router;
