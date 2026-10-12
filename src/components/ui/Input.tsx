import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, error, leading, id, ...props }, ref,
) {
  const inputId = id ?? props.name;
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--ink)]" htmlFor={inputId}>
      {label && <span>{label}</span>}
      <span className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--ink-soft)]">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn("min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]", leading && "ps-10", error && "border-[var(--danger)]", className)}
          {...props}
        />
      </span>
      {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : hint ? <span className="text-xs font-normal text-[var(--ink-soft)]">{hint}</span> : null}
    </label>
  );
});
