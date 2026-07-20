const prisma = require("../config/prisma");

const getOrCreateBalance = async (userId, leavePolicy, year) => {
  const existing = await prisma.leaveBalance.findUnique({
    where: { userId_leavePolicyId_year: { userId, leavePolicyId: leavePolicy.id, year } },
  });
  if (existing) return existing;

  return prisma.leaveBalance.create({
    data: {
      userId,
      leavePolicyId: leavePolicy.id,
      year,
      allocatedLeaves: leavePolicy.allocatedLeaves,
      usedLeaves: 0,
      remainingLeaves: leavePolicy.allocatedLeaves,
    },
  });
};

const applyUsage = (balanceId, deltaDays) =>
  prisma.leaveBalance.update({
    where: { id: balanceId },
    data: {
      usedLeaves: { increment: deltaDays },
      remainingLeaves: { decrement: deltaDays },
    },
  });

const listBalancesForUser = (userId, year) =>
  prisma.leaveBalance.findMany({
    where: { userId, year },
    include: { leavePolicy: true },
    orderBy: { leavePolicy: { leaveName: "asc" } },
  });

module.exports = { getOrCreateBalance, applyUsage, listBalancesForUser };
