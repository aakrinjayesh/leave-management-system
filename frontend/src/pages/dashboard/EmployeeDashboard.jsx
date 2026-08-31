import DashboardLayout from "../../components/layout/DashboardLayout";
import BirthdayCelebrationGate from "../../components/common/BirthdayCelebrationGate";
import WelcomeBanner from "../../components/common/WelcomeBanner";
import IntroduceYourselfCard from "../../components/common/IntroduceYourselfCard";
import { useAuth } from "../../context/AuthContext";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

// Deliberately minimal - leave balances, accrual history, recent requests
// and "Apply for leave" all live on "My Leave Requests" now, since that's
// where leave is actually managed (and the one page both employees and
// managers land on for their own leave). This page is the landing spot for
// whatever dashboard-level widgets come next.
export default function EmployeeDashboard() {
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
      <IntroduceYourselfCard />
    </DashboardLayout>
  );
}
