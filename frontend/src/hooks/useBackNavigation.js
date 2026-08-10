import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Module-level, not component state: DashboardLayout is mounted fresh by
// every page (each route renders its own <DashboardLayout> rather than a
// single persistent layout with an <Outlet/>), so a ref/state living inside
// the hook would reset on every navigation. Living at module scope lets the
// stack survive those remounts while still resetting on an actual page
// reload, since the module itself re-evaluates from scratch then.
let navigationStack = [];

function syncStack(pathname) {
  if (navigationStack.length === 0) {
    navigationStack = [pathname];
  } else if (navigationStack[navigationStack.length - 1] !== pathname) {
    // Matches real browser history: navigating to a page you've already
    // visited (e.g. clicking a sidebar link back to Dashboard) pushes a new
    // entry rather than jumping back to the earlier one. Only the Back
    // button itself pops the stack.
    navigationStack = [...navigationStack, pathname];
  }
}

// Tracks an in-app visited-path stack so the topbar Back button reflects
// real in-app history rather than the browser's (unreliable - history.length
// includes entries from before the app ever loaded, and history.back() can
// bounce the user out of the app entirely if there's nothing behind it).
// Disabled only when there's truly nothing before the current page - never
// force-reset just because the user is back on a "home" tab.
export function useBackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [trackedPathname, setTrackedPathname] = useState(null);

  // Sync the module-level stack to the current path during render (not in an
  // effect) - the officially-recommended way to adjust state when a route
  // changes, since it lets React redo this render immediately instead of
  // committing a stale frame first and correcting it after.
  if (trackedPathname !== location.pathname) {
    syncStack(location.pathname);
    setTrackedPathname(location.pathname);
  }

  const goBack = () => {
    if (navigationStack.length <= 1) return;

    navigationStack = navigationStack.slice(0, -1);
    const previous = navigationStack[navigationStack.length - 1];
    navigate(previous);
  };

  return { canGoBack: navigationStack.length > 1, goBack };
}
