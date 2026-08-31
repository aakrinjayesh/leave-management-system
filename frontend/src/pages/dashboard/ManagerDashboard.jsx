import DashboardLayout from "../../components/layout/DashboardLayout";
import BirthdayCelebrationGate from "../../components/common/BirthdayCelebrationGate";
import WelcomeBanner from "../../components/common/WelcomeBanner";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

// Team headcount/pending/on-leave-today now live on the Employees tab, and
// "Apply for leave" lives on My Leave Requests - this page is just the
// landing header, ready for whatever dashboard-level widgets come next.
export default function ManagerDashboard() {
  return (
    <DashboardLayout title="Dashboard">
      <BirthdayCelebrationGate />
      <WelcomeBanner />
    </DashboardLayout>
  );
}
