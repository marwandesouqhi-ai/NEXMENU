import { forwardRef, type ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-[var(--accent)] text-white shadow-sm hover:brightness-95",
        variant === "secondary" && "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--muted)]",
        variant === "ghost" && "text-[var(--ink-soft)] hover:bg-[var(--muted)] hover:text-[var(--ink)]",
        variant === "danger" && "bg-[var(--danger)] text-white",
        size === "sm" && "min-h-9 rounded-lg px-3 text-sm",
        size === "md" && "px-4 text-sm",
        size === "lg" && "min-h-13 px-6",
        size === "icon" && "size-11 p-0",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});
