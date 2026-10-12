import { Store } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { DashboardDetails } from "../types";

export function BranchesSection({ data }: { data: DashboardDetails }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.branches.map((branch) => (
        <Card key={branch.id} className="p-5">
          <div className="flex items-start justify-between">
            <span className="grid size-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Store className="size-5" />
            </span>
            <Badge>ACTIVE</Badge>
          </div>
          <h2 className="mt-5 text-lg font-black">{branch.name_en}</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{branch.address_en}</p>
          <p className="mt-4 text-sm font-bold">{branch.phone}</p>
        </Card>
      ))}
    </div>
  );
}

export default BranchesSection;
