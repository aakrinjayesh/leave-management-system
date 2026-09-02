const prisma = require("../config/prisma");
const ApiError = require("../utils/ApiError");

// ── Contract-hire payment model ─────────────────────────────────────────────
// Applies ONLY to accounts with employmentType = CONTRACT. Completely separate
// from the employee salary structure / payslip (payroll.service.js) - a flat
// Gross Payment, minus TDS at 2% or 10%, gives the Net Payment. No proration,
// no Basic/HRA/PF, no YTD, no income-tax computation.

const ALLOWED_TDS_RATES = [2, 10];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Gross - (Gross x rate%) = Net. Single source of truth for the arithmetic.
const computeAmounts = (grossPayment, tdsRatePercent) => {
  const tdsAmount = round2((grossPayment * tdsRatePercent) / 100);
  return {
    grossPayment: round2(grossPayment),
    tdsRatePercent,
    tdsAmount,
    netPayment: round2(grossPayment - tdsAmount),
  };
};

const assertContractHire = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw ApiError.notFound("Account not found.");
  }
  if (user.employmentType !== "CONTRACT") {
    throw ApiError.badRequest("This is only available for hire-to-contract accounts.");
  }
  return user;
};

const getStructureHistory = (userId) =>
  prisma.contractPaymentStructure.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
    include: { recordedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

// The Gross/TDS that was in effect for a given month - the latest entry whose
// effectiveFrom month is on or before that month, or null if none.
const getEffectiveStructure = async (userId, year, month) => {
  const targetSeq = year * 12 + month;
  const history = await prisma.contractPaymentStructure.findMany({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
  });
  return (
    history.find((entry) => {
      const d = new Date(entry.effectiveFrom);
      return d.getUTCFullYear() * 12 + (d.getUTCMonth() + 1) <= targetSeq;
    }) || null
  );
};

const validateStructureInput = ({ grossPayment, tdsRatePercent }) => {
  if (!(grossPayment >= 0)) {
    throw ApiError.badRequest("Please enter a valid Gross Payment amount.");
  }
  if (!ALLOWED_TDS_RATES.includes(Number(tdsRatePercent))) {
    throw ApiError.badRequest("TDS rate must be 2% or 10%.");
  }
};

// Adds a new dated structure row (the "Update" action).
const recordStructure = async (userId, data, recordedById) => {
  await assertContractHire(userId);
  validateStructureInput(data);
  await prisma.contractPaymentStructure.create({
    data: {
      userId,
      recordedById,
      grossPayment: round2(data.grossPayment),
      tdsRatePercent: Number(data.tdsRatePercent),
      effectiveFrom: data.effectiveFrom,
    },
  });
  return getStructureHistory(userId);
};

// Fixes the most recent structure row in place (the "Edit" action) - no new
// row. Falls back to creating the first one if none exists yet.
const updateLatestStructure = async (userId, data, recordedById) => {
  await assertContractHire(userId);
  validateStructureInput(data);

  const latest = await prisma.contractPaymentStructure.findFirst({
    where: { userId },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!latest) {
    return recordStructure(userId, data, recordedById);
  }

  await prisma.contractPaymentStructure.update({
    where: { id: latest.id },
    data: {
      recordedById,
      grossPayment: round2(data.grossPayment),
      tdsRatePercent: Number(data.tdsRatePercent),
      effectiveFrom: data.effectiveFrom,
    },
  });
  return getStructureHistory(userId);
};

// The numbers for one month, without saving - for the admin preview.
const previewPayment = async (userId, year, month) => {
  await assertContractHire(userId);
  const structure = await getEffectiveStructure(userId, year, month);
  if (!structure) {
    throw ApiError.badRequest(
      "No Gross Payment / TDS is set for this contract hire yet - add it from their details page first."
    );
  }
  return computeAmounts(structure.grossPayment, structure.tdsRatePercent);
};

const listPayments = (userId) =>
  prisma.contractPayment.findMany({
    where: { userId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

// Generates (or regenerates) the immutable slip for one month.
const generatePayment = async (userId, year, month, generatedById) => {
  const amounts = await previewPayment(userId, year, month);
  return prisma.contractPayment.upsert({
    where: { userId_month_year: { userId, month, year } },
    update: { ...amounts, generatedById },
    create: { userId, month, year, generatedById, ...amounts },
  });
};

module.exports = {
  ALLOWED_TDS_RATES,
  getStructureHistory,
  getEffectiveStructure,
  recordStructure,
  updateLatestStructure,
  previewPayment,
  listPayments,
  generatePayment,
};
