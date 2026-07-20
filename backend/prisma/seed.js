const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ---------- Users ----------
// hari.babu is now the bootstrap ADMIN account (admins can't self-register, so
// this is the one account that has to exist before anything else). The 3
// manager-tier accounts below are sample people that employees can pick as
// their manager in their profile. Employees are NOT seeded anymore - they
// self-register at /activate with any @aakrin.com email.
const ADMIN_USER = {
  firstName: "Hari",
  lastName: "Babu",
  email: "hari.babu@aakrin.com",
  userType: "ADMIN",
};

const MANAGER_TIER_USERS = [
  {
    firstName: "Rohith",
    lastName: "Kumar",
    email: "rohith.kumar@aakrin.com",
    userType: "MANAGER",
  },
  {
    firstName: "Divya",
    lastName: "Rao",
    email: "divya.rao@aakrin.com",
    userType: "MANAGER",
  },
  {
    firstName: "Sneha",
    lastName: "Iyer",
    email: "sneha.iyer@aakrin.com",
    userType: "MANAGER",
  },
];

// Test data from earlier phases - removed so the new self-registration +
// per-request routing flow can be tested cleanly.
const LEGACY_EMPLOYEE_EMAILS = ["test.employee@aakrin.com", "priya.sharma@aakrin.com", "arjun.mehta@aakrin.com"];

// ---------- Leave policies ----------
const LEAVE_POLICIES = [
  {
    leaveName: "Casual Leave",
    allocatedLeaves: 12,
    allowHalfDay: true,
    maxLeavesPerRequest: 5,
    longRequestThresholdDays: 4,
    longRequestMinNoticeDays: 20,
    description: "For short personal or planned time off. Requests longer than 4 days need at least 20 days' notice.",
  },
  {
    leaveName: "Sick Leave",
    allocatedLeaves: 8,
    allowHalfDay: true,
    maxLeavesPerRequest: 2,
    maxAdvanceBookingDays: 1,
    attachmentRequiredAboveDays: 2,
    maxLeavesPerRequestWithAttachment: 7,
    description:
      "For illness or medical needs. Only bookable for today or tomorrow, up to 2 days - longer requests need a supporting document (up to 7 days).",
  },
  {
    leaveName: "Earned Leave",
    allocatedLeaves: 15,
    allowHalfDay: true,
    maxLeavesPerRequest: 15,
    description: "Accrued leave for longer planned breaks.",
  },
  {
    leaveName: "Unpaid Leave",
    allocatedLeaves: 0,
    isUnlimited: true,
    isUnpaid: true,
    allowHalfDay: false,
    maxLeavesPerRequest: 30,
    description: "For time off beyond your paid balances - salary is deducted for each day taken (Loss of Pay).",
  },
];

const WEEKEND_POLICIES = [
  { dayOfWeek: "SATURDAY", weekNumber: "ALL", isHoliday: true },
  { dayOfWeek: "SUNDAY", weekNumber: "ALL", isHoliday: true },
];

const HOLIDAYS = [
  { holidayName: "Independence Day", holidayDate: new Date("2026-08-15"), isOptional: false },
  { holidayName: "Gandhi Jayanti", holidayDate: new Date("2026-10-02"), isOptional: false },
  { holidayName: "Diwali", holidayDate: new Date("2026-11-08"), isOptional: false },
  { holidayName: "Christmas", holidayDate: new Date("2026-12-25"), isOptional: true },
];

async function removeLegacyEmployees() {
  const { count } = await prisma.user.deleteMany({ where: { email: { in: LEGACY_EMPLOYEE_EMAILS } } });
  if (count > 0) {
    console.log(`Removed ${count} legacy test employee account(s) from earlier phases.`);
  }
}

async function seedUsers() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_USER.email },
    update: ADMIN_USER,
    create: ADMIN_USER,
  });
  console.log(`Seeded ${admin.userType}: ${admin.email} (id: ${admin.id}, status: ${admin.status})`);

  for (const data of MANAGER_TIER_USERS) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: data,
      create: data,
    });
    console.log(`Seeded ${user.userType}: ${user.email} (id: ${user.id})`);
  }

  return { admin };
}

async function seedLeavePolicies() {
  const policies = [];
  for (const data of LEAVE_POLICIES) {
    const policy = await prisma.leavePolicy.upsert({
      where: { leaveName: data.leaveName },
      update: data,
      create: data,
    });
    policies.push(policy);
  }
  console.log(`Seeded ${policies.length} leave policies.`);
  return policies;
}

async function seedCompanySettings() {
  const existing = await prisma.companySettings.findFirst();
  if (existing) {
    console.log("Company settings already exist, skipping.");
    return existing;
  }

  const settings = await prisma.companySettings.create({
    data: {
      companyName: "Aakrin",
      fiscalYearStartMonth: 4,
      timezone: "Asia/Kolkata",
      allowPastLeave: false,
      allowFutureLeave: true,
      maxFutureDays: 90,
    },
  });
  console.log("Seeded company settings.");
  return settings;
}

async function seedSalaryStructureConfig() {
  const existing = await prisma.salaryStructureConfig.findFirst();
  if (existing) {
    console.log("Salary structure config already exists, skipping.");
    return existing;
  }

  const config = await prisma.salaryStructureConfig.create({
    data: {
      basicPercentOfCtc: 40,
      hraPercentOfBasic: 50,
      ltaPercentOfBasic: 8.33,
      guaranteedAllowancePercentOfBasic: 10,
      conveyanceMonthly: 1600,
      pfPercentOfBasic: 12,
      professionalTax: 200,
    },
  });
  console.log("Seeded default salary structure config.");
  return config;
}

async function seedWeekendPolicies() {
  for (const data of WEEKEND_POLICIES) {
    await prisma.weekendPolicy.upsert({
      where: { dayOfWeek_weekNumber: { dayOfWeek: data.dayOfWeek, weekNumber: data.weekNumber } },
      update: data,
      create: data,
    });
  }
  console.log(`Seeded ${WEEKEND_POLICIES.length} weekend policy rows (Sat + Sun off).`);
}

async function seedHolidays(admin) {
  for (const data of HOLIDAYS) {
    await prisma.holiday.upsert({
      where: { holidayDate: data.holidayDate },
      update: { ...data, createdById: admin.id },
      create: { ...data, createdById: admin.id },
    });
  }
  console.log(`Seeded ${HOLIDAYS.length} holidays.`);
}

async function main() {
  await removeLegacyEmployees();
  const { admin } = await seedUsers();
  await seedLeavePolicies();
  await seedCompanySettings();
  await seedSalaryStructureConfig();
  await seedWeekendPolicies();
  await seedHolidays(admin);

  console.log(
    "\nNo employees seeded - go to /activate and register with any @aakrin.com email to test the employee flow."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
