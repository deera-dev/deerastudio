import { cn } from "@/lib/utils";

// REVISI Agustus 2026 v2 — "muted" sekarang translucent putih tipis
// (bukan bg-surface-2 solid) supaya konsisten dgn bahasa kaca di seluruh
// app; tone lain dipertegas border/glow-nya sedikit.
const TONES = {
  gold: "border-gold/40 bg-gold/[0.12] text-gold-soft",
  success: "border-success/40 bg-success-soft text-success",
  danger: "border-danger/40 bg-danger-soft text-danger",
  muted: "border-white/[0.1] bg-white/[0.04] text-text-faint",
} as const;

export function Badge({
  tone = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide backdrop-blur-sm",
        TONES[tone],
        className
      )}
      {...props}
    />
  );
}
