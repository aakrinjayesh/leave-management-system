const prisma = require("../config/prisma");

// Sets a user's manager and immediately re-routes any of their still-pending
// leave requests to the new manager, so nothing is left waiting on someone
// who's no longer relevant. Already-finished requests (approved/rejected/
// cancelled) keep their original routedTo/approvedBy - that's history and
// doesn't move.
const setUserManager = async (userId, managerId) => {
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { managerId } }),
    prisma.leaveRequest.updateMany({
      where: { userId, status: "PENDING" },
      data: { routedToId: managerId },
    }),
  ]);

  return user;
};

module.exports = { setUserManager };
