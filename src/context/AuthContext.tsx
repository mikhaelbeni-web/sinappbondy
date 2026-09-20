"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import type { SessionUser } from "@/lib/types";
import { hasPermission, type PermissionKey } from "@/lib/permissions";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  needsSetup: boolean;
  can: (perm: PermissionKey) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/me", { cache: "no-store" });
    const data = await res.json();
    setUser(data.user || null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const meRes = await fetch("/api/me", { cache: "no-store" });
        const meData = await meRes.json();
        if (meData.user) {
          setUser(meData.user);
          setLoading(false);
          return;
        }
        const setupRes = await fetch("/api/setup", { cache: "no-store" });
        const setupData = await setupRes.json();
        setNeedsSetup(!!setupData.needsSetup);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(clientAuth, email, password);
    const idToken = await cred.user.getIdToken();
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await firebaseSignOut(clientAuth).catch(() => {});
      throw new Error(data.error || "Connexion refusée.");
    }
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" });
    await firebaseSignOut(clientAuth).catch(() => {});
    setUser(null);
  }, []);

  const can = useCallback((perm: PermissionKey) => hasPermission(user?.role, perm), [user]);

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, can, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
