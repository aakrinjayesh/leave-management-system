import DashboardLayout from "../../components/layout/DashboardLayout";
import BirthdayCelebrationGate from "../../components/common/BirthdayCelebrationGate";
import WelcomeBanner from "../../components/common/WelcomeBanner";
import NeedsAttentionStrip from "../../components/common/NeedsAttentionStrip";
import TodayAttendanceCard from "../../components/common/TodayAttendanceCard";
import UpcomingHolidaysCard from "../../components/common/UpcomingHolidaysCard";
import IntroduceYourselfCard from "../../components/common/IntroduceYourselfCard";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

// Deliberately minimal - leave balances, accrual history, recent requests
// and "Apply for leave" all live on "My Leave Requests" now, since that's
// where leave is actually managed (and the one page both employees and
// managers land on for their own leave). This page is the landing spot for
// whatever dashboard-level widgets come next.
export default function EmployeeDashboard() {
  return (
    <DashboardLayout title="Dashboard">
      <BirthdayCelebrationGate />
      <WelcomeBanner />
      <NeedsAttentionStrip />
      <div className="dashboard-cols">
        <UpcomingHolidaysCard />
        <TodayAttendanceCard />
      </div>
      <IntroduceYourselfCard />
    </DashboardLayout>
  );
}
