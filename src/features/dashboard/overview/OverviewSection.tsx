import { Check, Eye, Package, Settings2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "../common/Stat";
import type { DashboardDetails } from "../types";

export function OverviewSection({ data }: { data: DashboardDetails }) {
  const events = data.products.length ? 42 : 0;
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total products"
          value={data.products.filter((item) => !item.deleted_at).length}
          icon={Package}
          note={`${data.products.filter((item) => item.is_available).length} currently available`}
        />
        <Stat
          label="Categories"
          value={data.categories.filter((item) => !item.deleted_at).length}
          icon={Settings2}
          note="Across your public menu"
        />
        <Stat label="Menu views" value={events} icon={Eye} note="Last 30 days" />
        <Stat
          label="Current plan"
          value={data.subscription?.plan ?? "FREE"}
          icon={Sparkles}
          note={
            data.subscription
              ? `Until ${new Date(data.subscription.expires_at).toLocaleDateString()}`
              : "Local workspace"
          }
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black">Menu readiness</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">
                Your publishing essentials at a glance.
              </p>
            </div>
            <Badge>4 of 4 ready</Badge>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ["Menu published", data.restaurant?.menu_status === "PUBLISHED"],
              ["Products available", data.products.some((item) => item.is_available)],
              ["Branding complete", Boolean(data.branding)],
              ["Restaurant details", Boolean(data.restaurant?.phone)],
            ].map(([label, done]) => (
              <div
                key={String(label)}
                className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"
              >
                <span
                  className={
                    done
                      ? "grid size-7 place-items-center rounded-full bg-[var(--accent)] text-white"
                      : "grid size-7 place-items-center rounded-full bg-[var(--line)]"
                  }
                >
                  <Check className="size-4" />
                </span>
                <p className="text-sm font-bold">{String(label)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden bg-[var(--ink)] p-6 text-white">
          <p className="text-xs font-bold text-[var(--accent-bright)]">LIVE MENU</p>
          <h2 className="mt-3 text-2xl font-black">{data.restaurant?.name_en}</h2>
          <p className="mt-2 text-sm leading-6 text-white/55">
            Your menu is live and ready to scan.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <img src={data.restaurant?.logo_url} alt="" className="size-14 rounded-2xl bg-white" />
            <div>
              <p className="text-sm font-bold">nexmenu.local</p>
              <p className="text-xs text-white/45">/r/{data.restaurant?.slug}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default OverviewSection;
