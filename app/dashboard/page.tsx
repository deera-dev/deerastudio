"use client";
// Dashboard — Agustus 2026 REVISI v2 (admin: "ditambahkan lagi dong
// informasinya disini, yang bisa berguna untuk usernya, terus apakah biaya
// generatenya sudah sesuai?").
//
// DUA PERUBAHAN UTAMA dari versi sebelumnya:
// 1. BUG DIPERBAIKI — biaya sebelumnya cuma jumlah ai_generation_sets.
//    total_cost (pipeline foto Generate/History), MELEWATKAN video_cost
//    (kolom terpisah di tabel yang sama) dan SELURUH biaya Content Studio
//    (caption/headline/storyboard AI, Foto Marketing AI, Foto Gabungan
//    Produk AI, video Content Studio) yang sebelumnya sama sekali tidak
//    tercatat di mana pun. Lihat lib/cost-log.ts utk detail investigasi &
//    tabel ai_cost_log baru yang jadi sumber kebenaran biaya Content
//    Studio. Sekarang dashboard menjumlah SEMUA sumber itu.
// 2. Info baru yang berguna: biaya sepanjang waktu (bukan cuma bulan ini),
//    rincian biaya per fitur bulan ini, konten dibuat bulan ini, daftar
//    "perlu perhatian" (set/post yang gagal), dan aktivitas terbaru lintas
//    Generate/History + Content Studio.
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clapperboard,
  ImageIcon,
  Sparkles,
  UsersRound,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import { usdToRp, FEATURE_LABELS, type AiCostFeature } from "@/lib/cost-log-shared";
import type { GenerationSetStatus, ContentPostStatus } from "@/types/database";

// Batas pengambilan riwayat mentah utk hitungan dashboard — cukup besar
// utk akurat di skala app saat ini (baru berjalan beberapa bulan). Kalau
// riwayat sudah jauh lebih besar dari ini, pindahkan ke agregasi lewat
// RPC/view Postgres alih-alih hitung di client.
const RAW_FETCH_LIMIT = 500;

type SetRow = {
  id: string;
  product_kode: string;
  status: GenerationSetStatus;
  total_cost: number | null;
  video_cost: number | null;
  video_status: "processing" | "completed" | "failed" | null;
  created_at: string;
};

type PostRow = {
  id: string;
  product_kode: string;
  content_type: "feed_single" | "carousel" | "reel";
  status: ContentPostStatus;
  created_at: string;
};

type CostLogRow = {
  feature: AiCostFeature;
  cost_usd: number;
  created_at: string;
};

type ActivityItem = {
  key: string;
  kind: "generate" | "content";
  label: string;
  sub: string;
  createdAt: string;
  tone: "success" | "gold" | "danger" | "muted";
};

type Stats = {
  skuThisMonth: number;
  contentThisMonth: number;
  costThisMonth: number;
  costAllTime: number;
  activeModels: number;
  breakdown: { label: string; rp: number }[];
  attention: { label: string; sub: string }[];
  recent: ActivityItem[];
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

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const SET_STATUS_LABEL: Record<GenerationSetStatus, string> = {
  completed: "Selesai",
  partial: "Sebagian gagal",
  processing: "Diproses",
  queued: "Antre",
  failed: "Gagal",
};

const SET_STATUS_TONE: Record<GenerationSetStatus, ActivityItem["tone"]> = {
  completed: "success",
  partial: "gold",
  processing: "gold",
  queued: "muted",
  failed: "danger",
};

const POST_STATUS_LABEL: Record<ContentPostStatus, string> = {
  published: "Diterbitkan",
  scheduled: "Dijadwalkan",
  draft: "Draft",
  failed: "Gagal",
};

const POST_STATUS_TONE: Record<ContentPostStatus, ActivityItem["tone"]> = {
  published: "success",
  scheduled: "gold",
  draft: "muted",
  failed: "danger",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const since = startOfMonthISO();

      const [setsRes, postsRes, costLogRes, modelsRes] = await Promise.all([
        supabase
          .from("ai_generation_sets")
          .select("id, product_kode, status, total_cost, video_cost, video_status, created_at")
          .order("created_at", { ascending: false })
          .limit(RAW_FETCH_LIMIT),
        supabase
          .from("content_posts")
          .select("id, product_kode, content_type, status, created_at")
          .order("created_at", { ascending: false })
          .limit(RAW_FETCH_LIMIT),
        supabase
          .from("ai_cost_log")
          .select("feature, cost_usd, created_at")
          .order("created_at", { ascending: false })
          .limit(RAW_FETCH_LIMIT),
        supabase.from("ai_models").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const sets = (setsRes.data ?? []) as SetRow[];
      const posts = (postsRes.data ?? []) as PostRow[];
      const costLogs = (costLogRes.data ?? []) as CostLogRow[];

      const setsThisMonth = sets.filter((s) => s.created_at >= since);
      const postsThisMonth = posts.filter((p) => p.created_at >= since);
      const costLogsThisMonth = costLogs.filter((c) => c.created_at >= since);

      // --- Biaya (lihat catatan bug-fix di header file) ---
      const setsCostThisMonth = setsThisMonth.reduce(
        (sum, s) => sum + (s.total_cost ?? 0) + (s.video_cost ?? 0),
        0
      );
      const costLogRpThisMonth = costLogsThisMonth.reduce((sum, c) => sum + usdToRp(c.cost_usd), 0);
      const costThisMonth = setsCostThisMonth + costLogRpThisMonth;

      const setsCostAllTime = sets.reduce((sum, s) => sum + (s.total_cost ?? 0) + (s.video_cost ?? 0), 0);
      const costLogRpAllTime = costLogs.reduce((sum, c) => sum + usdToRp(c.cost_usd), 0);
      const costAllTime = setsCostAllTime + costLogRpAllTime;

      // --- Rincian per fitur (bulan ini) ---
      const breakdownMap = new Map<string, number>();
      const fotoRp = setsThisMonth.reduce((sum, s) => sum + (s.total_cost ?? 0), 0);
      const videoRp = setsThisMonth.reduce((sum, s) => sum + (s.video_cost ?? 0), 0);
      if (fotoRp > 0) breakdownMap.set("Foto produk (Generate/History)", fotoRp);
      if (videoRp > 0) breakdownMap.set("Video (Generate/History)", videoRp);
      for (const c of costLogsThisMonth) {
        const label = FEATURE_LABELS[c.feature] ?? c.feature;
        breakdownMap.set(label, (breakdownMap.get(label) ?? 0) + usdToRp(c.cost_usd));
      }
      const breakdown = Array.from(breakdownMap.entries())
        .map(([label, rp]) => ({ label, rp }))
        .sort((a, b) => b.rp - a.rp);

      // --- Perlu perhatian ---
      const attention: { label: string; sub: string }[] = [];
      const failedSets = setsThisMonth.filter((s) => s.status === "failed" || s.status === "partial");
      const failedVideoSets = sets.filter((s) => s.video_status === "failed").slice(0, 3);
      const failedPosts = postsThisMonth.filter((p) => p.status === "failed");
      failedSets.slice(0, 3).forEach((s) =>
        attention.push({
          label: `Set ${s.product_kode}`,
          sub: s.status === "failed" ? "Generate foto gagal" : "Sebagian foto gagal",
        })
      );
      failedVideoSets.forEach((s) =>
        attention.push({ label: `Video ${s.product_kode}`, sub: "Generate video gagal" })
      );
      failedPosts.slice(0, 3).forEach((p) =>
        attention.push({ label: `Konten ${p.product_kode}`, sub: "Generate/publish konten gagal" })
      );

      // --- Aktivitas terbaru (gabungan set + post) ---
      const recentSets: ActivityItem[] = sets.slice(0, 8).map((s) => ({
        key: `set-${s.id}`,
        kind: "generate",
        label: `Set foto ${s.product_kode}`,
        sub: SET_STATUS_LABEL[s.status],
        createdAt: s.created_at,
        tone: SET_STATUS_TONE[s.status],
      }));
      const recentPosts: ActivityItem[] = posts.slice(0, 8).map((p) => ({
        key: `post-${p.id}`,
        kind: "content",
        label: `Konten ${p.product_kode}`,
        sub: POST_STATUS_LABEL[p.status],
        createdAt: p.created_at,
        tone: POST_STATUS_TONE[p.status],
      }));
      const recent = [...recentSets, ...recentPosts]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 6);

      setStats({
        skuThisMonth: setsThisMonth.length,
        contentThisMonth: postsThisMonth.length,
        costThisMonth,
        costAllTime,
        activeModels: modelsRes.count ?? 0,
        breakdown,
        attention,
        recent,
      });
    }
    load();
  }, []);

  const cards = [
    { label: "SKU diproses bulan ini", value: stats ? stats.skuThisMonth.toString() : "—", icon: ImageIcon },
    { label: "Konten dibuat bulan ini", value: stats ? stats.contentThisMonth.toString() : "—", icon: Sparkles },
    {
      label: "Biaya bulan ini",
      value: stats ? `Rp ${stats.costThisMonth.toLocaleString("id-ID")}` : "Rp —",
      icon: Banknote,
    },
    {
      label: "Biaya sepanjang waktu",
      value: stats ? `Rp ${stats.costAllTime.toLocaleString("id-ID")}` : "Rp —",
      icon: Wallet,
    },
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
            Pantau progres generate foto katalog AI dan Content Studio — SKU & konten yang sudah
            diproses, biaya terpakai (foto, video, dan teks AI), dan apa yang perlu ditindaklanjuti.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Rincian biaya bulan ini</CardTitle>
            <Wallet className="h-4 w-4 text-text-faint" />
          </CardHeader>
          <CardBody>
            {!stats ? (
              <p className="text-sm text-text-faint">Memuat...</p>
            ) : stats.breakdown.length === 0 ? (
              <p className="text-sm text-text-faint">Belum ada biaya tercatat bulan ini.</p>
            ) : (
              <ul className="space-y-3">
                {stats.breakdown.map((row) => {
                  const pct = stats.costThisMonth > 0 ? Math.round((row.rp / stats.costThisMonth) * 100) : 0;
                  return (
                    <li key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-text-muted">{row.label}</span>
                        <span className="font-medium text-text">Rp {row.rp.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full bg-gold/70" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Perlu perhatian</CardTitle>
            <AlertTriangle className="h-4 w-4 text-text-faint" />
          </CardHeader>
          <CardBody>
            {!stats ? (
              <p className="text-sm text-text-faint">Memuat...</p>
            ) : stats.attention.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Semua lancar, tidak ada yang perlu ditindaklanjuti.
              </div>
            ) : (
              <ul className="space-y-2">
                {stats.attention.map((item, i) => (
                  <li key={`${item.label}-${i}`} className="flex items-center justify-between rounded-lg border border-danger/20 bg-danger-soft/40 px-3 py-2 text-sm">
                    <span className="text-text">{item.label}</span>
                    <span className="text-text-faint">{item.sub}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Aktivitas terbaru</CardTitle>
            <Clapperboard className="h-4 w-4 text-text-faint" />
          </CardHeader>
          <CardBody>
            {!stats ? (
              <p className="text-sm text-text-faint">Memuat...</p>
            ) : stats.recent.length === 0 ? (
              <p className="text-sm text-text-faint">Belum ada aktivitas.</p>
            ) : (
              <ul className="space-y-1">
                {stats.recent.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.kind === "generate" ? "/history" : "/content"}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2">
                        {item.kind === "generate" ? (
                          <ImageIcon className="h-3.5 w-3.5 text-text-faint" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-text-faint" />
                        )}
                        <span className="text-text">{item.label}</span>
                        <Badge tone={item.tone}>{item.sub}</Badge>
                      </div>
                      <span className="text-xs text-text-faint">{timeAgo(item.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Aset AI aktif</CardTitle>
            <UsersRound className="h-4 w-4 text-text-faint" />
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Model aktif</span>
              <span className="font-medium text-text">{stats ? stats.activeModels : "—"}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-text-faint">
              Kelola model, pose, dan preset background/aksesoris lewat menu di sidebar. Biaya di atas
              adalah estimasi berdasarkan harga fal.ai yang diketahui (Nano Banana Pro, Kling, dan
              text-gen) — untuk angka tagihan yang pasti, cek langsung dashboard billing fal.ai.
            </p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
