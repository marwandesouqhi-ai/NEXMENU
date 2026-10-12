import { useState } from "react";
import { ImagePlus } from "lucide-react";

export function ImageUploader({ onSelect }: { onSelect: (file: File) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div><label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-[var(--muted)] px-4 text-sm font-bold"><ImagePlus className="size-4" />Choose image<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setError(""); void onSelect(file).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Image upload failed.")).finally(() => setBusy(false)); }} /></label>{busy && <p className="mt-1 text-xs text-[var(--ink-soft)]">Optimizing image…</p>}{error && <p className="mt-1 text-xs text-[var(--danger)]">{error}</p>}</div>;
}
