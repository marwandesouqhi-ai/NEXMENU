import { Gift, Sparkles, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import type { DashboardDetails } from "../types";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const getOfferLabel = (offer: DashboardDetails["offers"][number]) => {
  if (offer.type === "PERCENTAGE" && typeof offer.value === "number") {
    return `${offer.value}% off`;
  }
  if (offer.type === "FIXED" && typeof offer.value === "number") {
    return `${offer.value} EGP`;
  }
  if (offer.type === "SPECIAL") return "Special offer";
  return "Featured";
};

export function OffersSection({ data }: { data: DashboardDetails }) {
  const offers = data.offers ?? [];
  const activeOffers = offers.filter((offer) => offer.is_active);

  if (!offers.length) {
    return (
      <div className="grid gap-5">
        <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--ink-soft)]">
              Campaigns
            </p>
            <p className="mt-1 text-2xl font-black tracking-[-.04em]">Offers</p>
          </div>
          <Button>New offer</Button>
        </div>

        <EmptyState
          title="No offers yet"
          body="Create a limited-time promotion to drive more sales and highlight your best dishes."
          action={{ label: "Create offer", onClick: () => undefined }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent-strong)]">
          <Sparkles className="size-3.5" />
          {activeOffers.length} active
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[var(--muted)] px-3 py-2 text-xs font-bold text-[var(--ink-soft)]">
          <Clock3 className="size-3.5" />
          {offers.length} total
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {offers.map((offer) => (
          <Card key={offer.id} className="p-5">
            <div className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Gift className="size-5" />
              </span>
              <Badge className={offer.is_active ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--muted)] text-[var(--ink-soft)]"}>
                {offer.is_active ? "ACTIVE" : "HIDDEN"}
              </Badge>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black tracking-[-.03em]">{offer.title_en}</h2>
              <span className="rounded-full bg-[var(--muted)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-[var(--ink-soft)]">
                {offer.type}
              </span>
            </div>

            <p className="mt-3 text-sm font-bold text-[var(--accent)]">{getOfferLabel(offer)}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{offer.description_en}</p>

            <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--muted)] p-3 text-xs text-[var(--ink-soft)]">
              <p className="font-bold text-[var(--ink)]">Validity</p>
              <p className="mt-1">
                {formatDate(offer.starts_at)} — {formatDate(offer.ends_at)}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default OffersSection;
