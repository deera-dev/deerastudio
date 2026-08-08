import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted",
        className
      )}
      {...props}
    />
  );
}

// REVISI Agustus 2026 v2 — translucent putih tipis + backdrop-blur (bukan
// bg-surface-2 solid) supaya konsisten dgn bahasa "kaca" Card/Button, dan
// border putih transparan (bukan abu solid) utk tepi yang lebih halus.
const fieldBase =
  "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-sm text-text placeholder:text-text-faint backdrop-blur-sm transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:opacity-50";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "resize-none", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        fieldBase,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23918e9c%22><path d=%22M5.5 7.5L10 12l4.5-4.5H5.5z%22/></svg>')] bg-[position:right_0.75rem_center] bg-no-repeat pr-9",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function FieldHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-text-faint", className)} {...props} />;
}

export function FieldError({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs text-danger", className)} {...props} />;
}
