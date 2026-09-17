import DashboardLayout from "../../components/layout/DashboardLayout";
import ProfileContent from "./ProfileContent";

// Kept as a real route (no longer in the sidebar - Profile now opens from
// the topbar avatar as a modal, see ProfileModal.jsx) purely so existing
// deep links still work: email buttons and notification click-throughs
// (resignation decided, admin access granted/removed, salary updated, etc.)
// all point at "/profile" and should keep landing somewhere real.
export default function ProfilePage() {
  return (
    <DashboardLayout title="Profile">
      <ProfileContent />
    </DashboardLayout>
  );
}
