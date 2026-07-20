import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ClockAlert, CalendarOff, CalendarPlus } from "lucide-react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import StatCard from "../../components/common/StatCard";
import Button from "../../components/common/Button";
import Spinner from "../../components/common/Spinner";
import ApplyLeaveModal from "../employee/ApplyLeaveModal";
import { useAuth } from "../../context/AuthContext";
import * as managerLeaveApi from "../../api/managerLeave.api";
import "../../styles/dashboardShared.css";
import "./Dashboard.css";

export default function ManagerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);

  useEffect(() => {
    managerLeaveApi.getOverview().then(setOverview);
  }, []);

  return (
    <DashboardLayout title="Dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.firstName}.</h1>
          <p>Here's how your team's leave is looking.</p>
        </div>
        {user?.userType !== "ADMIN" && (
          <Button onClick={() => setIsApplyOpen(true)} className="page-header-btn">
            <CalendarPlus size={16} />
            Apply for leave
          </Button>
        )}
      </div>

      {!overview ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <Spinner size={28} />
        </div>
      ) : (
        <div className="stat-card-grid">
          <StatCard
            icon={<Users size={20} />}
            label="Total employees"
            value={overview.totalEmployees}
            onClick={() => navigate("/manager/employees")}
          />
          <StatCard
            icon={<ClockAlert size={20} />}
            label="Pending requests"
            value={overview.pendingRequestsCount}
            onClick={() => navigate("/manager/leave-requests")}
          />
          <StatCard icon={<CalendarOff size={20} />} label="On leave today" value={overview.onLeaveTodayCount} />
        </div>
      )}

      {isApplyOpen && (
        <ApplyLeaveModal onClose={() => setIsApplyOpen(false)} onSuccess={() => setIsApplyOpen(false)} />
      )}
    </DashboardLayout>
  );
}
