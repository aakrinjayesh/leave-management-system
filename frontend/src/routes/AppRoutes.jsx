import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import Spinner from "../components/common/Spinner";
import { useAuth } from "../context/AuthContext";
import { getDashboardPath } from "../utils/roleRoutes";

import LoginPage from "../pages/auth/LoginPage";
import VerifyOtpPage from "../pages/auth/VerifyOtpPage";
import ActivateAccountPage from "../pages/auth/ActivateAccountPage";
import ActivateSetPasswordPage from "../pages/auth/ActivateSetPasswordPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";

import EmployeeDashboard from "../pages/dashboard/EmployeeDashboard";
import ManagerDashboard from "../pages/dashboard/ManagerDashboard";
import AdminDashboard from "../pages/dashboard/AdminDashboard";

import MyLeaveRequestsPage from "../pages/employee/MyLeaveRequestsPage";
import LeaveCalendarPage from "../pages/employee/LeaveCalendarPage";

import EmployeesListPage from "../pages/manager/EmployeesListPage";
import EmployeeDetailPage from "../pages/manager/EmployeeDetailPage";
import TeamLeaveRequestsPage from "../pages/manager/TeamLeaveRequestsPage";
import TeamCalendarPage from "../pages/manager/TeamCalendarPage";
import TeamTimesheetsPage from "../pages/manager/TeamTimesheetsPage";
import ManagerEmployeeTimesheetPage from "../pages/manager/EmployeeTimesheetPage";
import TeamResignationsPage from "../pages/manager/TeamResignationsPage";
import TeamWfhPage from "../pages/manager/TeamWfhPage";

import AdminEmployeeTimesheetPage from "../pages/admin/EmployeeTimesheetPage";
import EmployeeLeaveDetailPage from "../pages/admin/EmployeeLeaveDetailPage";
import EmployeeDetailsPage from "../pages/admin/EmployeeDetailsPage";
import OfferLetterPage from "../pages/admin/OfferLetterPage";
import ManageLeavesPage from "../pages/admin/ManageLeavesPage";
import AllLeaveRequestsPage from "../pages/admin/AllLeaveRequestsPage";
import AllTimesheetsPage from "../pages/admin/AllTimesheetsPage";
import AllCalendarPage from "../pages/admin/AllCalendarPage";
import PayslipsPage from "../pages/admin/PayslipsPage";
import EmployeePayslipsPage from "../pages/admin/EmployeePayslipsPage";
import ReportPage from "../pages/admin/ReportPage";
import PayrollReportPage from "../pages/admin/PayrollReportPage";
import ResignationsPage from "../pages/admin/ResignationsPage";
import WfhRequestsPage from "../pages/admin/WfhRequestsPage";

import ProfilePage from "../pages/profile/ProfilePage";
import MyTimesheetPage from "../pages/timesheet/MyTimesheetPage";
import MyWfhPage from "../pages/wfh/MyWfhPage";
import MyAttendancePage from "../pages/attendance/MyAttendancePage";
import TeamAttendancePage from "../pages/manager/TeamAttendancePage";
import AllAttendancePage from "../pages/admin/AllAttendancePage";

const isNotAdmin = (user) => user.userType !== "ADMIN";
const isManager = (user) => user.isManager;
const isAdmin = (user) => user.userType === "ADMIN";

function HomeRedirect() {
  const { isAuthenticated, isInitializing, user } = useAuth();

  if (isInitializing) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getDashboardPath(user)} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />
      <Route path="/activate/set-password" element={<ActivateSetPasswordPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* "My own leave" pages - available to everyone except Admin (Admin
          sits at the top of the chain and doesn't apply for leave itself). */}
      <Route element={<ProtectedRoute check={isNotAdmin} />}>
        <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee/leave-requests" element={<MyLeaveRequestsPage />} />
        <Route path="/employee/calendar" element={<LeaveCalendarPage />} />
        <Route path="/timesheet" element={<MyTimesheetPage />} />
        <Route path="/wfh" element={<MyWfhPage />} />
        <Route path="/attendance" element={<MyAttendancePage />} />
      </Route>

      {/* Profile - available to every authenticated account, Admin included
          (Admin just sees a reduced version without the manager section). */}
      <Route element={<ProtectedRoute />}>
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      {/* Manager-side pages - gated on isManager (derived from who has picked
          this account as their manager), not userType. Any account, Admin
          included, can end up here if someone reports to them. */}
      <Route element={<ProtectedRoute check={isManager} />}>
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/manager/attendance" element={<TeamAttendancePage />} />
        <Route path="/manager/employees" element={<EmployeesListPage />} />
        <Route path="/manager/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/manager/leave-requests" element={<TeamLeaveRequestsPage />} />
        <Route path="/manager/calendar" element={<TeamCalendarPage />} />
        <Route path="/manager/timesheets" element={<TeamTimesheetsPage />} />
        <Route path="/manager/timesheets/employees/:id" element={<ManagerEmployeeTimesheetPage />} />
        <Route path="/manager/resignations" element={<TeamResignationsPage />} />
        <Route path="/manager/wfh-requests" element={<TeamWfhPage />} />
      </Route>

      <Route element={<ProtectedRoute check={isAdmin} />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/reports" element={<ReportPage />} />
        <Route path="/admin/report" element={<PayrollReportPage />} />
        <Route path="/admin/leave-requests" element={<AllLeaveRequestsPage />} />
        <Route path="/admin/timesheets" element={<AllTimesheetsPage />} />
        <Route path="/admin/calendar" element={<AllCalendarPage />} />
        <Route path="/admin/attendance" element={<AllAttendancePage />} />
        <Route path="/admin/manage-leaves" element={<ManageLeavesPage />} />
        <Route path="/admin/users/:id/timesheet" element={<AdminEmployeeTimesheetPage />} />
        <Route path="/admin/users/:id/leaves" element={<EmployeeLeaveDetailPage />} />
        <Route path="/admin/users/:id/details" element={<EmployeeDetailsPage />} />
        <Route path="/admin/users/:id/offer-letter" element={<OfferLetterPage />} />
        <Route path="/admin/payslips" element={<PayslipsPage />} />
        <Route path="/admin/users/:id/payslips" element={<EmployeePayslipsPage />} />
        <Route path="/admin/resignations" element={<ResignationsPage />} />
        <Route path="/admin/wfh-requests" element={<WfhRequestsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
