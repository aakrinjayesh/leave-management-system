export const getDashboardPath = (user) => {
  if (!user) return "/employee/dashboard";
  if (user.userType === "ADMIN") return "/admin/dashboard";
  if (user.isManager) return "/manager/dashboard";
  return "/employee/dashboard";
};
