import DashboardLayout from "../../components/layout/DashboardLayout";
import BirthdayCelebrationGate from "../../components/common/BirthdayCelebrationGate";
import WelcomeBanner from "../../components/common/WelcomeBanner";
import { useAuth } from "../../context/AuthContext";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

// Team headcount/pending/on-leave-today now live on the Employees tab, and
// "Apply for leave" lives on My Leave Requests - this page is just the
// landing header, ready for whatever dashboard-level widgets come next.
export default function ManagerDashboard() {
  const { user } = useAuth();

  return (
    <DashboardLayout title="Dashboard">
      <BirthdayCelebrationGate />
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.firstName}.</h1>
          <p>Here's your workspace at a glance.</p>
        </div>
      </div>
      <WelcomeBanner />
    </DashboardLayout>
  );
}
