import { Leaf } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return <Link to="/" className={cn("inline-flex items-center gap-2.5 font-extrabold tracking-[-0.04em]", light ? "text-white" : "text-[var(--ink)]")}><span className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-white"><Leaf className="size-4" /></span>{!compact && <span>NEXMENU</span>}</Link>;
}
