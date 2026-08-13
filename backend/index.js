const app = require("./src/app");
const env = require("./src/config/env");
const prisma = require("./src/config/prisma");
const { startBirthdayCronJob } = require("./src/jobs/birthday.job");
const { startAnniversaryCronJob } = require("./src/jobs/anniversary.job");

const start = async () => {
  await prisma.$connect();

  app.listen(env.PORT, () => {
    console.log(`Server is running on http://localhost:${env.PORT}`);
  });

  startBirthdayCronJob();
  startAnniversaryCronJob();
};

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
