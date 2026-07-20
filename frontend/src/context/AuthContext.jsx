import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { setAccessToken, setOnUnauthorized } from "../api/axiosClient";
import * as authApi from "../api/auth.api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const loginSession = useCallback((accessToken, sessionUser) => {
    setAccessToken(accessToken);
    setUser(sessionUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  // Re-fetches the current user (e.g. after the profile's manager selection
  // changes isManager/manager for this session).
  const refreshUser = useCallback(async () => {
    const data = await authApi.getMe();
    setUser(data.user);
    return data.user;
  }, []);

  // On first load, try to silently restore a session from the httpOnly refresh cookie.
  useEffect(() => {
    setOnUnauthorized(clearSession);

    (async () => {
      try {
        const data = await authApi.refreshToken();
        loginSession(data.accessToken, data.user);
      } catch {
        clearSession();
      } finally {
        setIsInitializing(false);
      }
    })();
  }, [clearSession, loginSession]);

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isInitializing,
    loginSession,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
