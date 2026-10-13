import { useState } from "react";
import {
  BarChart3, Bell, Building2, CreditCard, Gift, LayoutDashboard, Menu, Palette,
  QrCode, Settings, ShieldCheck, Store, Users, X,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Brand } from "@/components/shared/Brand";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/app/AuthContext";
import { restaurantService } from "@/services/restaurants";
import { cn } from "@/lib/cn";

const nav = [
  ["", "Overview", LayoutDashboard], ["menu", "Menu", Menu], ["offers", "Offers", Gift],
  ["qr", "QR codes", QrCode], ["analytics", "Analytics", BarChart3], ["branding", "Branding", Palette],
  ["branches", "Branches", Building2], ["team", "Team", Users], ["subscription", "Subscription", CreditCard],
  ["settings", "Settings", Settings],
] as const;

export default function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { session, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const mine = useQuery({
    queryKey: ["restaurants", "mine"],
    queryFn: () => restaurantService.mine(session!),
    enabled: Boolean(session),
  });

  const activeRestaurant = mine.data?.[0];
  const isSuperAdmin = profile?.platform_role === "SUPER_ADMIN";
  const isCloud = import.meta.env.VITE_DATA_ADAPTER === "supabase";

  const logout = async () => { await signOut(); navigate("/login"); };

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between px-5">
        <Brand />
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)}>
          <X className="size-5" />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map(([path, label, Icon]) => (
          <NavLink
            key={label}
            to={`/dashboard${path ? `/${path}` : ""}`}
            end={!path}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--ink-soft)] transition hover:bg-[var(--muted)] hover:text-[var(--ink)]",
                isActive && "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
              )
            }
          >
            <Icon className="size-4.5" />
            {label}
          </NavLink>
        ))}
        {isSuperAdmin && (
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-soft)]/50 px-3 text-sm font-bold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
          >
            <ShieldCheck className="size-4.5" />
            System Admin
          </Link>
        )}
      </nav>
      <div className="m-3 rounded-2xl bg-[var(--ink)] p-4 text-white">
        <p className="text-xs font-bold text-[var(--accent-bright)]">
          {isCloud ? "CLOUD MODE" : "LOCAL MODE"}
        </p>
        <p className="mt-2 text-xs leading-5 text-white/60">
          {isCloud ? "Connected to Supabase PostgreSQL." : "Data is stored in this browser only."}
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-[var(--line)] bg-[var(--surface)] lg:flex lg:flex-col">
        {sidebar}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-72 flex-col bg-[var(--surface)]" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-[var(--line)] bg-[var(--canvas)]/90 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu className="size-5" />
            </Button>
            <div>
              <p className="text-sm font-bold">
                {activeRestaurant ? activeRestaurant.name_en : "Restaurant workspace"}
              </p>
              <p className="text-xs text-[var(--ink-soft)]">
                {activeRestaurant ? (activeRestaurant.cuisine_type || "Digital Menu") : "Ready to create menu"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeRestaurant ? (
              <Link to={`/r/${activeRestaurant.slug}`}>
                <Button variant="secondary" size="sm">
                  <Store className="size-4" />
                  <span className="hidden sm:inline">View menu</span>
                </Button>
              </Link>
            ) : (
              <Link to="/onboarding">
                <Button size="sm">
                  <Store className="size-4" />
                  <span className="hidden sm:inline">Create Restaurant</span>
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="icon">
              <Bell className="size-5" />
            </Button>
            <button
              type="button"
              onClick={() => void logout()}
              className="grid size-10 place-items-center rounded-full bg-[var(--accent)] text-sm font-black text-white"
              title="Sign out"
            >
              {profile?.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 pb-24 sm:p-7 lg:p-9">
          <Outlet />
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[var(--line)] bg-[var(--surface)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {nav.slice(0, 4).map(([path, label, Icon]) => (
          <NavLink
            key={label}
            to={`/dashboard${path ? `/${path}` : ""}`}
            end={!path}
            className={({ isActive }) =>
              cn(
                "grid min-h-16 place-items-center py-2 text-[10px] font-bold text-[var(--ink-faint)]",
                isActive && "text-[var(--accent)]",
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
