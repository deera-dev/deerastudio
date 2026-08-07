"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Banknote, ImageIcon, UsersRound } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

// Dashboard — statistik sederhana (PRD §14): SKU diproses bulan ini, biaya
// akumulasi, model aktif.
type Stats = {
  skuThisMonth: number;
  costThisMonth: number;
  activeModels: number;
};

function startOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
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

      const costThisMonth = (setsRes.data ?? []).reduce(
        (sum, row) => sum + (row.total_cost ?? 0),
        0
      );

      setStats({
        skuThisMonth: setsRes.count ?? 0,
        costThisMonth,
        activeModels: modelsRes.count ?? 0,
      });
    }
    load();
  }, []);

  const cards = [
    {
      label: "SKU diproses bulan ini",
      value: stats ? stats.skuThisMonth.toString() : "—",
      icon: ImageIcon,
    },
    {
      label: "Biaya generate bulan ini",
      value: stats ? `Rp ${stats.costThisMonth.toLocaleString("id-ID")}` : "Rp —",
      icon: Banknote,
    },
    {
      label: "Model aktif",
      value: stats ? stats.activeModels.toString() : "—",
      icon: UsersRound,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Ringkasan"
        title="Dashboard"
        description="Pantau progres generate foto katalog AI bulan ini."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className="p-5">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 text-gold">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="text-sm text-text-muted">{card.label}</div>
              <div className="mt-1 font-display text-3xl font-semibold text-text">
                {card.value}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}
