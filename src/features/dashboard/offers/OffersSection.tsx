import { Gift } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { DashboardDetails } from "../types";

export function OffersSection({ data }: { data: DashboardDetails }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.offers.map((offer) => (
        <Card key={offer.id} className="p-5">
          <div className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Gift className="size-5" />
            </span>
            <Badge>{offer.is_active ? "ACTIVE" : "HIDDEN"}</Badge>
          </div>
          <h2 className="mt-5 text-lg font-black">{offer.title_en}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{offer.description_en}</p>
          <p className="mt-4 text-xs font-bold text-[var(--ink-faint)]">
            Ends {new Date(offer.ends_at).toLocaleDateString()}
          </p>
        </Card>
      ))}
    </div>
  );
}

export default OffersSection;
