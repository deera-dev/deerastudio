import { cn } from "@/lib/utils";

// Kartu kaca (glassmorphism) — REVISI Agustus 2026 v2 (lihat catatan
// panjang di globals.css utk alasan lengkap kenapa versi sebelumnya
// tampil flat/opaque, bukan kaca).
//
// Lapisan kartu ini (dari belakang ke depan):
// 1. bg-surface/55 + backdrop-blur-2xl — dasar kaca gelap TEMBUS PANDANG
//    (bukan blok solid terang seperti sebelumnya), nge-blur apa pun di
//    belakangnya (glow warna + grain di body{}, lihat globals.css).
// 2. before: gradient diagonal putih transparan tipis (kiri-atas terang
//    -> kanan-bawah bersih) — simulasi cahaya menyentuh permukaan kaca,
//    elemen KUNCI yang bikin sesuatu terasa "kaca" bukan "kartu biasa".
// 3. border putih transparan tipis (bukan border abu solid) — tepi kaca
//    yang menangkap cahaya, dikombinasi shadow inset di baris atas.
// 4. shadow ambient lembut+dalam di bawah — kesan "mengambang".
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/55 shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_32px_64px_-28px_rgba(0,0,0,0.8)] backdrop-blur-2xl",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.07] before:via-white/[0.015] before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative border-b border-white/[0.06] px-5 py-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("relative font-display text-lg font-semibold text-text", className)}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative px-5 py-4", className)} {...props} />;
}
