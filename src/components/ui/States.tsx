import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import { Button } from "./Button";
export function LoadingState({ label = "Loading NEXMENU…" }: { label?: string }) {
  return <div className="grid min-h-60 place-items-center text-[var(--ink-soft)]"><div className="grid justify-items-center gap-3"><LoaderCircle className="size-6 animate-spin text-[var(--accent)]" /><p className="text-sm">{label}</p></div></div>;
}
export function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; onClick: () => void } }) {
  return <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-[var(--line)] p-6 text-center"><div className="grid max-w-sm justify-items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--muted)]"><Inbox className="size-5" /></span><div><p className="font-bold">{title}</p><p className="mt-1 text-sm text-[var(--ink-soft)]">{body}</p></div>{action && <Button onClick={action.onClick}>{action.label}</Button>}</div></div>;
}
export function ErrorState({ title = "Something went wrong", body, retry }: { title?: string; body: string; retry?: () => void }) {
  return <div className="grid min-h-60 place-items-center p-6 text-center"><div className="grid max-w-sm justify-items-center gap-3"><AlertTriangle className="size-7 text-[var(--warning)]" /><p className="text-lg font-bold">{title}</p><p className="text-sm text-[var(--ink-soft)]">{body}</p>{retry && <Button variant="secondary" onClick={retry}>Try again</Button>}</div></div>;
}
