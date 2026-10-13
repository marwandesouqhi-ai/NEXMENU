import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authService, type SafeProfile } from "@/services/auth";
import type { Session } from "@/types/domain";
import { LoadingState } from "@/components/ui/States";

interface AuthValue {
  session: Session | null;
  profile: SafeProfile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
export const AuthContext = createContext<AuthValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<SafeProfile | null>(null);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    await authService.initialize();
    const current = await authService.session();
    setSession(current);
    setProfile(await authService.profile(current));
    setReady(true);
  }, []);
  useEffect(() => {
    let active = true;
    void authService.initialize().then(async () => {
      const current = await authService.session();
      const currentProfile = await authService.profile(current);
      if (active) {
        setSession(current);
        setProfile(currentProfile);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, []);
  const value = useMemo<AuthValue>(() => ({
    session, profile, refresh,
    signIn: async (email, password) => { await authService.signIn(email, password); await refresh(); },
    signUp: async (email, password, name) => { await authService.signUp(email, password, name); await refresh(); },
    signOut: async () => { await authService.signOut(); await refresh(); },
  }), [session, profile, refresh]);
  if (!ready) return <LoadingState label="Preparing your local workspace…" />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing.");
  return value;
}
