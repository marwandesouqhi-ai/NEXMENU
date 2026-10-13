import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";
import { IS_ADMIN_TARGET } from "./target";
import { Button } from "@/components/ui/Button";

function AdminNotAuthorized({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] p-6 text-center">
      <div className="max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-[var(--danger-soft)] text-[var(--danger)]">
          <ShieldAlert className="size-6" />
        </div>
        <h1 className="text-2xl font-black">Access Denied · غير مصرح بالدخول</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
          This administration portal is restricted strictly to NEXMENU Super Administrators.
          Your account does not possess platform administrative privileges.
        </p>
        <p className="mt-2 text-xs text-[var(--ink-faint)]" dir="rtl">
          هذه البوابة مخصصة حصرياً للمدير العام للنظام (SUPER_ADMIN). حسابك لا يمتلك صلاحيات إدارة المنصة.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => void onSignOut().then(() => { window.location.href = "/login"; })}
          >
            Sign out · تسجيل الخروج
          </Button>
        </div>
      </div>
    </main>
  );
}

export function Protected({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  return session ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function AdminOnly({ children }: { children: ReactNode }) {
  const { session, profile, signOut } = useAuth();
  if (!session) return <Navigate to="/login" replace state={{ from: "/admin" }} />;
  if (profile?.platform_role !== "SUPER_ADMIN") {
    if (IS_ADMIN_TARGET) {
      return <AdminNotAuthorized onSignOut={signOut} />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
