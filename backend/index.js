const app = require("./src/app");
const env = require("./src/config/env");
const prisma = require("./src/config/prisma");
const { startBirthdayCronJob } = require("./src/jobs/birthday.job");
const { startAnniversaryCronJob } = require("./src/jobs/anniversary.job");

// const start = async () => {
//   await prisma.$connect();

//   app.listen(env.PORT, () => {
//     console.log(`Server is running on http://localhost:${env.PORT}`);
//   });

//   startBirthdayCronJob();
//   startAnniversaryCronJob();
// };
const start = async () => {
  const PORT = Number(process.env.PORT) || env.PORT || 5000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });

  try {
    console.log("Connecting to database...");

    await prisma.$connect();

    console.log("Database connected successfully");

    startBirthdayCronJob();
    startAnniversaryCronJob();

    console.log("Cron jobs started");
  } catch (err) {
    console.error("Failed to connect to database:", err);
  }
};

start();

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
