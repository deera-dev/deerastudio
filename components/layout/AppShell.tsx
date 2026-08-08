"use client";
// Shell navigasi — REVISI Agustus 2026 v2 (+ background interaktif Agustus 2026 v3).
// Desktop: rail ikon mengambang (floating) di kiri, tanpa logo/wordmark
// (permintaan admin: "ga perlu ada logo disana, hapus aja").
// Mobile: REVISI — sebelumnya topbar+hamburger+drawer geser (permintaan
// admin: "navbarnya dibuat dibawah, persis seperti desktop tapi
// disesuaikan mobile"). Sekarang: bottom bar kaca mengambang berisi SEMUA
// ikon nav yang sama persis dengan rail desktop (bahasa visual identik,
// cuma orientasi horizontal + posisi bawah), plus tombol logout kaca kecil
// mengambang di kanan-atas (menggantikan slot logout yang dulu ada di
// dalam drawer). Orientasi halaman cukup dari PageHeader tiap halaman +
// tooltip judul di tiap ikon rail (desktop) — mobile tidak ada tooltip,
// tapi 7 ikon lucide yang dipakai cukup unik bentuknya utk dikenali.
//
// v3: seluruh shell (rail + bottom nav + main content) dibungkus
// KineticGrid — canvas grid yang warp ke arah cursor & ripple tiap klik,
// aktif di SEMUA halaman kerja (permintaan admin: background interaktif
// global, bukan cuma 1 halaman). Warna sudah disesuaikan jadi emas brand
// (lihat components/ui/KineticGrid.tsx), transparan supaya nyatu dgn
// radial-gradient glow yang sudah ada di body (globals.css).
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, History, LayoutDashboard, Megaphone, Palette, UsersRound, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import KineticGrid from "@/components/ui/KineticGrid";
import { LogoutButton } from "./LogoutButton";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/models", label: "Models", icon: UsersRound },
  { href: "/poses", label: "Poses", icon: Camera },
  { href: "/presets", label: "Presets", icon: Palette },
  { href: "/generate", label: "Generate", icon: Wand2 },
  { href: "/history", label: "History", icon: History },
  { href: "/content", label: "Content Studio", icon: Megaphone },
];

// Rail ikon desktop — kapsul mengambang vertikal-tengah, cuma ikon (tanpa
// label), active state jadi lingkaran solid emas.
function IconRail() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-white/[0.08] bg-ink-2/70 p-2 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl md:flex">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors",
              active ? "text-ink" : "text-text-faint hover:bg-white/[0.06] hover:text-text"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-rail-desktop"
                className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-soft to-gold shadow-[0_0_22px_rgba(217,162,78,0.5)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative z-10 h-[18px] w-[18px]" />
          </Link>
        );
      })}
      <div className="my-1 h-px w-6 bg-white/[0.08]" />
      <LogoutButton iconOnly />
    </aside>
  );
}

// Bottom bar kaca mengambang mobile — SATU-SATUNYA nav di mobile
// (menggantikan topbar+drawer lama), bahasa visual identik dgn IconRail
// desktop cuma horizontal. layoutId TERPISAH dari rail desktop
// ("nav-active-bar-mobile" vs "nav-active-rail-desktop") supaya pill aktif
// tidak "terbang" lintas breakpoint saat window di-resize (keduanya
// ada di DOM sekaligus, disembunyikan lewat CSS md:hidden/hidden md:flex).
function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="nav-bottom-safe fixed inset-x-3 z-30 flex items-center justify-between gap-0.5 rounded-full border border-white/[0.08] bg-ink-2/80 p-1.5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_50px_-16px_rgba(0,0,0,0.85)] backdrop-blur-2xl md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={cn(
              "relative flex h-11 flex-1 items-center justify-center rounded-full transition-colors",
              active ? "text-ink" : "text-text-faint active:bg-white/[0.06]"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-bar-mobile"
                className="absolute inset-0 rounded-full bg-gradient-to-b from-gold-soft to-gold shadow-[0_0_16px_rgba(217,162,78,0.5)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative z-10 h-[18px] w-[18px]" />
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <KineticGrid>
      <IconRail />
      <MobileBottomNav />

      {/* Logout — kaca kecil mengambang kanan-atas, MOBILE ONLY (desktop
          logout ada di dalam IconRail). */}
      <div className="nav-top-safe fixed right-3 z-30 md:hidden">
        <LogoutButton
          iconOnly
          className="border border-white/[0.08] bg-ink-2/70 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_12px_28px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        />
      </div>

      <main className="pb-24 md:pb-0 md:pl-28">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-8 sm:px-6 lg:px-10 md:pt-8">{children}</div>
      </main>
    </KineticGrid>
  );
}
