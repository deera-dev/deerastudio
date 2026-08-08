"use client";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// REVISI Agustus 2026 v2 — primary sekarang gradient emas (bukan flat)
// dgn inset highlight atas (kesan permukaan cembung/mengkilap) + glow
// warna gold yang lebih jenuh, konsisten dgn palet baru globals.css.
// outline/ghost dipakaikan border putih transparan tipis (bukan abu
// solid) supaya konsisten dgn bahasa "kaca" Card.tsx.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-wide transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink cursor-pointer disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-gold-soft to-gold text-ink shadow-[0_1px_0_0_rgba(255,255,255,0.45)_inset,0_10px_28px_-10px_rgba(217,162,78,0.6)] hover:shadow-[0_1px_0_0_rgba(255,255,255,0.45)_inset,0_14px_36px_-8px_rgba(217,162,78,0.8)] hover:brightness-[1.06]",
        outline:
          "border border-white/[0.12] bg-white/[0.02] text-text backdrop-blur-sm hover:border-gold/50 hover:bg-gold/[0.06] hover:text-gold-soft",
        ghost: "text-text-muted bg-transparent hover:bg-white/[0.05] hover:text-text",
        danger:
          "border border-danger/40 text-danger bg-danger/[0.04] hover:bg-danger-soft hover:border-danger",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
