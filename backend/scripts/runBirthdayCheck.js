// Manually runs the birthday check outside of its daily schedule - handy for
// testing without waiting for midnight IST. Usage: node scripts/runBirthdayCheck.js
const { runBirthdayCheck } = require("../src/jobs/birthday.job");
const prisma = require("../src/config/prisma");

runBirthdayCheck()
  .then((result) => {
    console.log("Birthday check complete:", result);
  })
  .catch((err) => {
    console.error("Birthday check failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
