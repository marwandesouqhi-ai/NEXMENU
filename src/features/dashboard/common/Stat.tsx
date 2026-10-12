import type { ComponentType } from "react";
import { Card } from "@/components/ui/Card";

export function Stat({
  label,
  value,
  icon: Icon,
  note,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  note?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--ink-soft)]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-[-.04em]">{value}</p>
          {note && <p className="mt-2 text-xs text-[var(--ink-faint)]">{note}</p>}
        </div>
        <span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

export default Stat;
