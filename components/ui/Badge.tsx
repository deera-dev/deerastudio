import { cn } from "@/lib/utils";

const TONES = {
  gold: "border-gold/40 bg-gold/10 text-gold-soft",
  success: "border-success/40 bg-success-soft text-success",
  danger: "border-danger/40 bg-danger-soft text-danger",
  muted: "border-border-strong bg-surface-2 text-text-faint",
} as const;

export function Badge({
  tone = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
