import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-full bg-[var(--accent-soft)] px-2.5 text-xs font-bold text-[var(--accent-strong)]", className)} {...props} />;
}
