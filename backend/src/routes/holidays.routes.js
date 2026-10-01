const express = require("express");
const { authenticate } = require("../middlewares/auth.middleware");
const { listUpcomingHolidays } = require("../controllers/holidays.controller");

const router = express.Router();

router.get("/upcoming", authenticate, listUpcomingHolidays);

module.exports = router;
