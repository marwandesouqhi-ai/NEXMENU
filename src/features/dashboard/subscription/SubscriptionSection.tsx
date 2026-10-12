import { Check } from "lucide-react";
import { PLANS } from "@/config/plans";
import { Card } from "@/components/ui/Card";
import type { DashboardDetails } from "../types";

export function SubscriptionSection({ data }: { data: DashboardDetails }) {
  const subscription = data.subscription;
  const plan = PLANS[subscription?.plan ?? "FREE"];
  return (
    <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr]">
      <Card className="overflow-hidden bg-[var(--ink)] p-7 text-white">
        <p className="text-xs font-bold tracking-[.15em] text-[var(--accent-bright)]">
          CURRENT PLAN
        </p>
        <p className="mt-4 text-4xl font-black">{plan.name}</p>
        <p className="mt-3 text-sm text-white/55">
          {subscription?.status ?? "ACTIVE"} · Renews manually
        </p>
        <div className="mt-10 border-t border-white/10 pt-5 text-sm text-white/55">
          <p>
            Start: {subscription ? new Date(subscription.starts_at).toLocaleDateString() : "—"}
          </p>
          <p className="mt-2">
            Expires: {subscription ? new Date(subscription.expires_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </Card>
      <Card className="p-7">
        <h2 className="text-xl font-black">Plan capabilities</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            [plan.productLimit ? `${plan.productLimit} products` : "Unlimited products", true],
            [plan.branchLimit ? `${plan.branchLimit} branches` : "Unlimited branches", true],
            ["Menu analytics", plan.analytics],
            ["Advanced branding", plan.advancedBranding],
            ["Remove NEXMENU branding", plan.hideBranding],
          ].map(([label, enabled]) => (
            <div
              key={String(label)}
              className="flex min-h-14 items-center gap-3 rounded-xl bg-[var(--muted)] px-4"
            >
              <span
                className={
                  enabled
                    ? "grid size-6 place-items-center rounded-full bg-[var(--accent)] text-white"
                    : "grid size-6 place-items-center rounded-full bg-[var(--line)] text-[var(--ink-faint)]"
                }
              >
                <Check className="size-3.5" />
              </span>
              <p className="text-sm font-bold">{String(label)}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-[var(--ink-soft)]">
          To change your plan, contact NEXMENU. Plans are assigned manually; there is no online
          payment.
        </p>
      </Card>
    </div>
  );
}

export default SubscriptionSection;
