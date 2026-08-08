"use client";
// Dashboard — statistik sederhana: SKU diproses bulan ini, biaya
// akumulasi, model aktif. Layout dikasih sentuhan modern (greeting +
// tanggal, kartu stat dgn ikon pill & angka besar) terinspirasi dashboard
// referensi admin, dark glassmorphism (lihat globals.css & Card.tsx utk
// bahasa visual "kaca" yang dipakai di seluruh app).
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, ImageIcon, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  skuThisMonth: number;
  costThisMonth: number;
  activeModels: number;
};

function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const since = startOfMonthISO();

      const [setsRes, modelsRes] = await Promise.all([
        supabase
          .from("ai_generation_sets")
          .select("total_cost", { count: "exact" })
          .gte("created_at", since),
        supabase.from("ai_models").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const costThisMonth = (setsRes.data ?? []).reduce((sum, row) => sum + (row.total_cost ?? 0), 0);

      setStats({
        skuThisMonth: setsRes.count ?? 0,
        costThisMonth,
        activeModels: modelsRes.count ?? 0,
      });
    }
    load();
  }, []);

  const cards = [
    { label: "SKU diproses bulan ini", value: stats ? stats.skuThisMonth.toString() : "—", icon: ImageIcon },
    { label: "Biaya generate bulan ini", value: stats ? `Rp ${stats.costThisMonth.toLocaleString("id-ID")}` : "Rp —", icon: Banknote },
    { label: "Model aktif", value: stats ? stats.activeModels.toString() : "—", icon: UsersRound },
  ];

  const today = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <AppShell>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/55 p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_32px_64px_-28px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 480px 260px at 90% -15%, rgba(217,162,78,0.22), transparent), radial-gradient(ellipse 380px 240px at 105% 115%, rgba(139,124,240,0.16), transparent)",
          }}
        />
        <div className="relative">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.2em] text-gold">{today}</p>
          <h1 className="font-display text-3xl font-semibold text-text">
            {greeting()}, tim Deera 👋
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">
            Pantau progres generate foto katalog AI bulan ini — SKU yang sudah diproses, biaya
            terpakai, dan model yang aktif digunakan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="p-5 transition-shadow hover:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_20px_48px_-20px_rgba(217,162,78,0.28)]">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 text-gold">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="text-sm text-text-muted">{card.label}</div>
              <div className="mt-1 font-display text-3xl font-semibold text-text">{card.value}</div>
            </Card>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
