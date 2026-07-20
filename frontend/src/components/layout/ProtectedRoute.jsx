import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Spinner from "../common/Spinner";

// `check` receives the current user and decides whether this route is
// reachable. Access is no longer purely userType-based - manager-only routes
// gate on the derived `isManager` flag instead, since any account can end up
// with direct reports.
export default function ProtectedRoute({ check }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (check && !check(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
