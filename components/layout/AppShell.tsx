"use client";
// Shell navigasi — rail ikon mengambang (floating) di desktop, drawer geser
// di mobile. SENGAJA tanpa logo/wordmark (permintaan admin: "ga perlu ada
// logo disana, hapus aja") — orientasi halaman cukup dari PageHeader tiap
// halaman + tooltip judul di tiap ikon rail.
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  History,
  LayoutDashboard,
  Megaphone,
  Menu,
  Palette,
  UsersRound,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
// label), active state jadi lingkaran solid oranye persis kayak referensi.
function IconRail() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-1.5 rounded-full border border-border bg-ink-2/70 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl md:flex">
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
              active ? "text-ink" : "text-text-faint hover:bg-surface-2 hover:text-text"
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active-rail"
                className="absolute inset-0 rounded-full bg-gold shadow-[0_0_20px_rgba(255,107,53,0.45)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative z-10 h-[18px] w-[18px]" />
          </Link>
        );
      })}
      <div className="my-1 h-px w-6 bg-border" />
      <LogoutButton iconOnly />
    </aside>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <IconRail />

      {/* Topbar mobile — tanpa logo, cuma tombol menu */}
      <header className="sticky top-0 z-30 flex items-center justify-end border-b border-border bg-ink-2/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Drawer mobile */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-ink-2 md:hidden"
            >
              <div className="flex items-center justify-end px-4 py-4">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 px-3">
                {NAV.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-colors",
                        active ? "bg-gold text-ink" : "text-text-muted hover:bg-surface-2 hover:text-text"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-border px-3 py-4">
                <LogoutButton />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="md:pl-28">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
