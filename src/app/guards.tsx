import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthContext";
export function Protected({ children }: { children: ReactNode }) {
  const { session } = useAuth(); const location = useLocation();
  return session ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}
export function AdminOnly({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  if (!session) return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  return profile?.platform_role === "SUPER_ADMIN" ? children : <Navigate to="/dashboard" replace />;
}
