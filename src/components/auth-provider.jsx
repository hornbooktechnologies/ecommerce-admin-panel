"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loginRequest, logoutRequest, refreshRequest } from "@/lib/api-client";
import { canAccessArea, homeForUser, tenantIdForUser } from "@/lib/auth-routing";
import { GlobalLoader } from "@/components/global-loader";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState({ status: "loading", user: null, accessToken: null, activeTenantId: null });
  const refreshInFlight = useRef(null);

  const authenticatedSession = useCallback((data) => {
    const savedTenantId = window.localStorage.getItem("commerce.activeTenantId");
    const activeTenantId = tenantIdForUser(data.user, "admin", savedTenantId)
      || tenantIdForUser(data.user, "vendor", savedTenantId);
    return { status: "authenticated", user: data.user, accessToken: data.accessToken, activeTenantId };
  }, []);

  const refreshSession = useCallback(async () => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = refreshRequest()
        .then((data) => {
          setSession(authenticatedSession(data));
          return data;
        })
        .catch((error) => {
          setSession({ status: "anonymous", user: null, accessToken: null, activeTenantId: null });
          throw error;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }, [authenticatedSession]);

  useEffect(() => {
    refreshSession().catch(() => {});
  }, [refreshSession]);

  const login = useCallback(async (input) => {
    const data = await loginRequest(input);
    setSession(authenticatedSession(data));
    return data.user;
  }, [authenticatedSession]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setSession({ status: "anonymous", user: null, accessToken: null, activeTenantId: null });
    }
  }, []);

  const selectTenant = useCallback((tenantId) => {
    setSession((current) => {
      const allowed = current.user?.assignments?.some((assignment) => assignment.tenantId === tenantId);
      if (!allowed) return current;
      window.localStorage.setItem("commerce.activeTenantId", tenantId);
      return { ...current, activeTenantId: tenantId };
    });
  }, []);

  const value = useMemo(() => ({ ...session, login, logout, refreshSession, selectTenant }), [session, login, logout, refreshSession, selectTenant]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return value;
}

export function AuthGuard({ area, children, loadingFallback = null }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    } else if (status === "authenticated" && !canAccessArea(user, area)) {
      router.replace(homeForUser(user));
    }
  }, [area, router, status, user]);

  if (status !== "authenticated" || !canAccessArea(user, area)) {
    return loadingFallback || <GlobalLoader label="Opening secure workspace" />;
  }

  return children;
}
