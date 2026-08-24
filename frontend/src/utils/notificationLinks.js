// Maps a notification's type to where clicking it should navigate - the
// same type can be sent to different roles (e.g. LEAVE_SUBMITTED goes to
// whichever manager/admin needs to approve it), so the destination is
// resolved against the viewer's own role rather than the notification data,
// which doesn't carry a specific record id to deep-link to.
export const getNotificationDestination = (type, user) => {
  const isAdmin = user?.userType === "ADMIN";
  const isManager = !!user?.isManager;

  switch (type) {
    case "LEAVE_SUBMITTED":
    case "LEAVE_CANCELLED":
      return isManager ? "/manager/leave-requests" : null;
    case "LEAVE_DECIDED":
      return "/employee/leave-requests";
    case "TIMESHEET_SUBMITTED":
      if (isManager) return "/manager/timesheets";
      return isAdmin ? "/admin/reports" : null;
    case "TIMESHEET_DECIDED":
      return "/timesheet";
    case "RESIGNATION_SUBMITTED":
    case "RESIGNATION_WITHDRAWN":
      if (isAdmin) return "/admin/resignations";
      return isManager ? "/manager/resignations" : null;
    case "RESIGNATION_DECIDED":
    case "ADMIN_GRANTED":
    case "ADMIN_REMOVED":
    case "SALARY_STRUCTURE_UPDATED":
    case "ANNIVERSARY":
      return "/profile";
    case "LEAVE_POLICY_CHANGED":
      if (isAdmin) return "/admin/manage-leaves";
      return isManager ? "/manager/calendar" : "/employee/calendar";
    case "PROJECT_UPDATED":
      return isAdmin ? "/admin/reports" : "/timesheet";
    case "ACCOUNT_APPROVAL_REQUESTED":
      return isAdmin ? "/admin/dashboard" : null;
    case "ACCOUNT_APPROVAL_DECIDED":
      return "/profile";
    case "PROFILE_UPDATED":
      return isAdmin ? "/admin/dashboard" : null;
    default:
      return null;
  }
};
