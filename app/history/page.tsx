"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { showImageLightbox } from "@/components/ui/ImageLightbox";
import { promptDialog } from "@/components/ui/PromptDialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Generation, GenerationSet, GenerationSetStatus, ImageRole } from "@/types/database";

// History — riwayat per SKU/set (PRD §7.7, §14). Publish push hasil terpilih
// ke katalog Deera lewat Cloudinary (PRD §15 v0.4).
//
// REVISI Agustus 2026 v2 (feedback admin: "dibuat pagination aja ya,
// nanti makin banyak malah susah liatnya, dan bikin search juga ya") —
// sebelumnya .limit(50) client-side TANPA search sama sekali (riwayat di
// luar 50 set terbaru sudah tidak kelihatan lagi!). Sekarang pagination +
// search kode produk SERVER-SIDE lewat .range()/.ilike() + count:"exact",
// jadi tetap ringan & benar berapa pun jumlah riwayatnya.
const PAGE_SIZE = 10;

type SetWithGenerations = GenerationSet & { ai_generations: Generation[] };

const STATUS_TONE: Record<GenerationSetStatus, "success" | "gold" | "danger" | "muted"> = {
  completed: "success",
  partial: "gold",
  processing: "gold",
  queued: "muted",
  failed: "danger",
};

// REVISI #7 (Agustus 2026, "4 foto tetap") — label ramah utk role baru,
// dipakai di grid hasil di bawah (menggantikan raw snake_case).
const ROLE_LABELS: Record<ImageRole, string> = {
  utama: "Utama",
  angle: "Angle (Belakang)",
  seri: "Seri Warna",
  kolase_gabungan: "Kolase Gabungan",
  kolase_detail: "Kolase Detail",
  detail: "Detail (lama)",
};

// Kolase (kolase_gabungan/kolase_detail) adalah gambar KOMPOSIT statis —
// ada logo brand & label teks "DETAIL" nempel di atasnya. Menganimasikannya
// lewat Kling akan bikin logo/teks itu ikut terdistorsi gerakan kamera,
// jadi kedua role ini SENGAJA dikecualikan dari daftar foto yang bisa
// dipilih utk "Video Cerita Gabungan" (lihat lib/prompts/video-motion.ts
// utk catatan sisi lain dari pengecualian yang sama).
const VIDEO_EXCLUDED_ROLES: ImageRole[] = ["kolase_gabungan", "kolase_detail"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [sets, setSets] = useState<SetWithGenerations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Search kode produk + pagination server-side (lihat catatan REVISI v2
  // di atas). searchInput = ketikan mentah (langsung), search = versi
  // ter-debounce yang benar-benar dipakai query — sama pola dgn search
  // produk di app/generate/page.tsx.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  // "+ Tambah Warna Seri" — nambah warna baru ke set yang SUDAH ADA tanpa
  // re-generate utama (lihat app/api/generation-sets/[id]/add-seri/route.ts).
  const [productWarnaOptions, setProductWarnaOptions] = useState<string[]>([]);
  const [addSeriWarna, setAddSeriWarna] = useState("");
  const [addSeriImage, setAddSeriImage] = useState<string | null>(null);
  const [addingSeri, setAddingSeri] = useState(false);
  // "Video Cerita Gabungan (AI)" (Agustus 2026, REVISI v2) — admin minta
  // SEMUA foto post digabung jadi 1 video utuh (bukan pilih 1 foto), jadi
  // panel ini level SET (bukan per-foto lagi seperti versi lama). Progress
  // asli (video_status/video_clip_jobs/video_url) disimpan di
  // ai_generation_sets & dipoll dari sana — lihat effect polling di bawah
  // & app/api/generation-sets/[id]/generate-video/{route,status/route}.ts.
  const [composeUrls, setComposeUrls] = useState<string[]>([]); // urut = urutan cerita
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState(5); // per-klip
  const [suggestingMotion, setSuggestingMotion] = useState(false);
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [videoNowTick, setVideoNowTick] = useState(() => Date.now()); // detak elapsed-time saat processing

  async function load(searchTerm: string, pageIndex: number) {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (searchTerm.trim()) {
      query = query.ilike("product_kode", `%${searchTerm.trim()}%`);
    }
    const from = pageIndex * PAGE_SIZE;
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    const rows = (data as SetWithGenerations[]) ?? [];
    setSets(rows);
    setTotalCount(count ?? 0);
    // Pertahankan seleksi kalau item yang sedang dibuka masih ada di
    // halaman/hasil search baru ini — kalau tidak (pindah halaman/search
    // berubah), default ke item pertama.
    setSelectedId((prev) => (rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
    setLoading(false);
  }

  // Debounce ketikan search -> reset ke halaman 0 (hasil search baru
  // mulai dari awal, bukan lanjut di halaman lama yang mungkin sudah
  // tidak relevan).
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    load(search, page);
  }, [search, page]);

  const selected = sets.find((s) => s.id === selectedId) ?? null;

  // Ambil daftar warna produk ini (products.warna) tiap kali pindah set —
  // dipakai buat dropdown "+ Tambah Warna Seri" di bawah, supaya admin milih
  // dari warna yang benar-benar terdaftar, bukan ketik manual (typo-prone).
  useEffect(() => {
    setAddSeriWarna("");
    setAddSeriImage(null);
    setVideoPrompt("");
    // REVISI (Agustus 2026, setelah review video test — admin kirim 5 video
    // referensi ASLI hasil syuting kamera, bukan AI, jadi target "video
    // gabungan berputar mulus" TIDAK realistis dicapai lewat sambung
    // beberapa klip AI terpisah — hard-cut & foto sumber yang beda
    // scene/pose bikin hasilnya "kasar" & produk kelihatan berubah).
    // Default sekarang HANYA foto Utama (1 klip, 1 gerakan muter anggun,
    // TANPA sambungan sama sekali) — paling mendekati gaya video referensi
    // (1 shot kontinu). Admin tetap BISA tambah foto lain manual di grid di
    // bawah kalau mau eksperimen video multi-klip, tapi itu bukan lagi
    // default.
    const utamaGen = (selected?.ai_generations ?? []).find(
      (g) => g.image_role === "utama" && g.status === "completed" && g.output_image_url
    );
    setComposeUrls(utamaGen ? [utamaGen.output_image_url as string] : []);
    if (!selected) {
      setProductWarnaOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("warna")
        .eq("kode", selected.product_kode)
        .single();
      if (!cancelled) setProductWarnaOptions((data?.warna as string[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Polling "Video Cerita Gabungan" — jalan HANYA saat video_status set
  // yang sedang dibuka === "processing". Semua progress disimpan di DB
  // (ai_generation_sets.video_*), jadi polling ini aman dimulai ulang
  // kapan saja (termasuk setelah admin pindah halaman lalu balik &
  // membuka set yang sama lagi — progress lanjut dari titik terakhir,
  // tidak hilang). Lihat app/api/generation-sets/[id]/generate-video/status/.
  useEffect(() => {
    if (!selected || selected.video_status !== "processing") return;
    let cancelled = false;
    const tick = setInterval(() => setVideoNowTick(Date.now()), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/generation-sets/${selected.id}/generate-video/status`);
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setSets((prev) =>
        prev.map((s) =>
          s.id === selected.id
            ? {
                ...s,
                video_status: data.videoStatus,
                video_url: data.videoUrl,
                video_error_message: data.errorMessage,
                video_clip_jobs: data.clipJobs,
              }
            : s
        )
      );
      if (data.videoStatus === "completed") toast.success("Video cerita gabungan selesai!");
      if (data.videoStatus === "failed") toast.error(data.errorMessage || "Generate video gagal");
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(poll);
    };
    // Sengaja cuma depend on id+status (bukan objek `selected` utuh) —
    // field lain (video_clip_jobs dll) BERUBAH tiap kali polling ini
    // sendiri nulis lewat setSets, kalau ikut jadi dependency effect ini
    // akan restart interval terus-menerus tiap 3 detik.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.video_status]);

  // Warna yang belum punya baris "seri" di set ini & bukan warna utama —
  // itulah pilihan yang tersisa utk ditambahkan.
  const usedSeriWarna = new Set(
    (selected?.ai_generations ?? [])
      .filter((g) => g.image_role === "seri" && g.variant_warna)
      .map((g) => g.variant_warna as string)
  );
  const availableSeriWarna = productWarnaOptions.filter(
    (w) => w !== selected?.product_warna && !usedSeriWarna.has(w)
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  async function refreshOne(id: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .eq("id", id)
      .single();
    if (data) {
      setSets((prev) => prev.map((s) => (s.id === id ? (data as SetWithGenerations) : s)));
    }
  }

  // REVISI (Agustus 2026 — admin regenerate D-024-HMS berulang kali tapi
  // hasil masih belum sesuai, tanya "bisa ga kita kasih prompt lagi buat
  // benerin dibandingkan generate dari awal?"): sebelumnya tombol ini
  // langsung regenerate tanpa tanya apa-apa (cuma re-roll seed acak dgn
  // prompt yang sama persis). Sekarang, KHUSUS role yang full re-render
  // lewat Nano Banana Pro (utama/angle/seri — bukan kolase/detail yang
  // cuma compositing/crop), tanya dulu lewat promptDialog apa yang mau
  // diperbaiki — diteruskan sbg correctionNote (lihat app/api/generations/
  // [id]/regenerate/route.ts & lib/prompts/nano-banana-generate.ts).
  async function handleRegenerate(genId: string) {
    if (!selected) return;
    const gen = selected.ai_generations.find((g) => g.id === genId);
    const supportsNote =
      gen?.image_role === "utama" || gen?.image_role === "angle" || gen?.image_role === "seri";

    let note: string | undefined;
    if (supportsNote) {
      const result = await promptDialog({
        title: `Generate Ulang — ${ROLE_LABELS[gen!.image_role] ?? gen!.image_role}`,
        description:
          "Kalau hasil sebelumnya ada yang kurang pas, tulis di sini apa yang mau diperbaiki (Inggris lebih akurat) — AI diprioritaskan memperbaiki itu, bukan cuma coba ulang dgn seed acak. Kosongkan aja kalau cuma mau coba ulang biasa.",
        placeholder: "mis. remove the bookshelf in the background, make the pose more relaxed...",
        confirmLabel: "Generate Ulang",
      });
      if (result === null) return; // dibatalkan dari dialog
      note = result;
    }

    setRegeneratingId(genId);
    try {
      const res = await fetch(`/api/generations/${genId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Regenerate gagal");
      toast.success("Gambar berhasil digenerate ulang");
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regenerate gagal");
    } finally {
      setRegeneratingId(null);
    }
  }

  function toggleComposeUrl(url: string) {
    setComposeUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  async function handleSuggestMotion() {
    if (!selected) return;
    setSuggestingMotion(true);
    try {
      const res = await fetch("/api/generate-video-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selected.product_kode,
          durationSeconds: videoDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyarankan motion prompt");
      setVideoPrompt(data.motionPrompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyarankan motion prompt");
    } finally {
      setSuggestingMotion(false);
    }
  }

  async function handleGenerateVideo() {
    if (!selected || composeUrls.length === 0) return;
    setSubmittingVideo(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrls: composeUrls,
          prompt: videoPrompt.trim() || undefined,
          durationPerClipSeconds: videoDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generate video gagal");
      toast.success(`Mulai generate ${composeUrls.length} klip video...`);
      setVideoNowTick(Date.now());
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate video gagal");
    } finally {
      setSubmittingVideo(false);
    }
  }

  async function handlePublish() {
    if (!selected) return;
    const utama = selected.ai_generations.find((g) => g.image_role === "utama");
    // REVISI #7 (Agustus 2026, "4 foto tetap") — slot products.detail
    // (galeri foto tambahan di katalog) sekarang diisi dari SEMUA baris
    // non-utama/non-seri di set ini: "angle" (badan penuh pose lain),
    // "kolase_gabungan" & "kolase_detail" (kolase bermerek) sbg bonus foto
    // galeri. Ditulis generik (bukan whitelist per-role) supaya publish
    // TETAP jalan apa adanya utk riwayat lama yang masih punya baris
    // "detail" (crop close-up, sebelum REVISI #7 menghapus role itu dari
    // alur baru) — Deera belum punya kolom terpisah utk tiap role ini.
    const detail = selected.ai_generations.filter(
      (g) => g.image_role !== "utama" && g.image_role !== "seri"
    );
    // Bisa lebih dari satu warna seri per set (satu baris per warna varian).
    const seri = selected.ai_generations.filter((g) => g.image_role === "seri");

    if (!utama || utama.status !== "completed") {
      toast.error("Foto utama belum ada/gagal — tidak bisa publish");
      return;
    }
    if (detail.some((d) => d.status !== "completed")) {
      toast.error("Ada foto detail/angle yang belum selesai atau gagal");
      return;
    }
    if (seri.some((s) => s.status !== "completed")) {
      toast.error("Ada foto seri warna yang belum selesai atau gagal");
      return;
    }

    const ok = await confirmDialog({
      title: `Publish ke katalog Deera?`,
      description: `Ini akan menimpa foto produk "${selected.product_kode}" yang tampil publik di katalog Deera. Pastikan hasil sudah dicek dulu.`,
      confirmLabel: "Ya, publish",
      danger: true,
    });
    if (!ok) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: {
            utama: utama.id,
            detail: detail.map((d) => d.id),
            seri: seri.map((s) => s.id),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish gagal");
      toast.success(`"${selected.product_kode}" berhasil dipublish ke katalog`);
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish gagal");
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddSeri() {
    if (!selected || !addSeriWarna || !addSeriImage) return;
    setAddingSeri(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/add-seri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriEntries: [{ warna: addSeriWarna, image: addSeriImage }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Gagal tambah warna seri");
      }
      toast.success(`Warna "${addSeriWarna}" berhasil ditambahkan`);
      setAddSeriWarna("");
      setAddSeriImage(null);
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal tambah warna seri");
    } finally {
      setAddingSeri(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Riwayat"
        title="History"
        description="Semua set foto yang pernah digenerate. Pilih satu untuk lihat detail, generate ulang gambar, atau publish ke katalog."
      />

      {/* Search kode produk — di luar kondisi loading/kosong di bawah,
          supaya tetap kelihatan & bisa dikosongkan lagi walau hasil
          search-nya 0. */}
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cari kode produk (mis. D-018-KBR)..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-text-faint">Memuat...</p>
      ) : sets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Clock className="h-8 w-8 text-text-faint" />
          <p className="text-sm text-text-muted">
            {search
              ? `Tidak ada riwayat dengan kode produk yang cocok "${search}".`
              : "Belum ada riwayat generate."}
          </p>
        </Card>
      ) : (
        // REVISI Agustus 2026 v2 (feedback admin: "column base") — daftar
        // riwayat & panel detail stack vertikal full-width, bukan
        // sidebar+main lagi.
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            {sets.map((set) => {
              const utama = set.ai_generations.find((g) => g.image_role === "utama");
              return (
                <button
                  key={set.id}
                  onClick={() => setSelectedId(set.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    selectedId === set.id
                      ? "border-gold/60 bg-gold/5"
                      : "border-border bg-surface hover:border-border-strong"
                  )}
                >
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-surface-2">
                    {utama?.output_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={utama.output_image_url}
                        alt={set.product_kode}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{set.product_kode}</div>
                    <div className="text-xs text-text-faint">{formatDate(set.created_at)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[set.status]}>{set.status}</Badge>
                    {set.published_at && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination — server-side, lihat load() di atas. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 text-xs text-text-faint">
              <span>
                {totalCount} riwayat total · halaman {page + 1} dari {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Berikutnya
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{selected.product_kode}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                    {selected.published_at ? (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3 w-3" />
                        Published {formatDate(selected.published_at)}
                      </Badge>
                    ) : (
                      <Button size="sm" loading={publishing} onClick={handlePublish}>
                        <UploadCloud className="h-4 w-4" />
                        Publish ke Katalog
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="mb-4 text-sm text-text-muted">
                    Total biaya estimasi: Rp {selected.total_cost?.toLocaleString("id-ID") ?? "—"} ·
                    Dibuat {formatDate(selected.created_at)}
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {selected.ai_generations.map((gen) => (
                      <div
                        key={gen.id}
                        className="overflow-hidden rounded-lg border border-border bg-surface-2"
                      >
                        {gen.output_image_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              showImageLightbox(
                                gen.output_image_url as string,
                                ROLE_LABELS[gen.image_role] ?? gen.image_role
                              )
                            }
                            className="block w-full"
                            title="Lihat full screen"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={gen.output_image_url}
                              alt={gen.image_role}
                              className="aspect-[3/4] w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex aspect-[3/4] w-full items-center justify-center text-xs text-text-faint">
                            {gen.status === "failed" ? "Gagal" : "..."}
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2">
                          <div>
                            <div className="text-xs font-medium text-text">
                              {ROLE_LABELS[gen.image_role] ?? gen.image_role}
                              {gen.image_role === "seri" && gen.variant_warna && (
                                <span className="text-text-muted"> — {gen.variant_warna}</span>
                              )}
                            </div>
                            <div className="text-xs text-text-faint">
                              {gen.status}
                              {gen.video_status === "completed" && gen.video_url && (
                                <span className="ml-1 text-gold">· video</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleRegenerate(gen.id)}
                              disabled={regeneratingId === gen.id}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold disabled:opacity-50"
                              title="Generate ulang"
                            >
                              <RefreshCw
                                className={cn("h-3.5 w-3.5", regeneratingId === gen.id && "animate-spin")}
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

{(() => {
                    const completedPhotos = selected.ai_generations.filter(
                      (g) =>
                        g.status === "completed" &&
                        g.output_image_url &&
                        !VIDEO_EXCLUDED_ROLES.includes(g.image_role)
                    );
                    const videoStatus = selected.video_status;
                    const clipJobs = selected.video_clip_jobs ?? [];
                    const doneClips = clipJobs.filter((j) => j.status === "completed").length;
                    const stageLabel =
                      clipJobs.length === 0
                        ? "Memulai..."
                        : doneClips < clipJobs.length
                          ? `Generate klip ${doneClips}/${clipJobs.length}...`
                          : "Menggabungkan video...";
                    const elapsedSeconds = selected.video_started_at
                      ? Math.max(0, Math.floor((videoNowTick - new Date(selected.video_started_at).getTime()) / 1000))
                      : 0;

                    return (
                      <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text">
                          <Film className="h-3.5 w-3.5 text-gold" />
                          Video Cerita Gabungan (AI)
                        </div>
                        <p className="mb-3 text-xs text-text-faint">
                          Foto tetap 100% sama — tiap foto terpilih di bawah dianimasikan jadi klip
                          pendek (gerakan halus, tanpa audio). Kling 3.0 Pro maks 15 detik per klip.
                        </p>
                        <p className="mb-3 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs text-text-muted">
                          <span className="font-medium text-text">Rekomendasi:</span> pakai 1 foto
                          saja (Utama, sudah dipilih di bawah) — hasil video AI paling mulus &amp;
                          tanpa sambungan kalau cuma 1 klip. Kalau lebih dari 1 foto dipilih, semua
                          klip digabung urut jadi 1 video via hard-cut (tanpa transisi) — bisa
                          terasa kasar/patah kalau foto sumbernya beda scene, dan sambungan pose
                          besar (mis. depan→belakang) berisiko bikin kain terlihat berubah bentuk.
                        </p>

                        {videoStatus === "processing" && (
                          <div className="mb-3 flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold-soft">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            {stageLabel} · {elapsedSeconds}s berjalan
                          </div>
                        )}

                        {videoStatus === "failed" && selected.video_error_message && (
                          <div className="mb-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                            Gagal: {selected.video_error_message}
                          </div>
                        )}

                        {videoStatus === "completed" && selected.video_url && (
                          <div className="mb-3 overflow-hidden rounded-md border border-border">
                            <video
                              src={selected.video_url}
                              controls
                              loop
                              className="aspect-[3/4] w-full max-w-[220px] bg-black object-cover"
                            />
                          </div>
                        )}

                        {completedPhotos.length === 0 ? (
                          <FieldHint>Belum ada foto yang selesai digenerate di set ini.</FieldHint>
                        ) : (
                          <>
                            <Label>Foto yang dipakai (urut sesuai klik)</Label>
                            <div className="mb-3 flex flex-wrap gap-2">
                              {completedPhotos.map((g) => {
                                const url = g.output_image_url as string;
                                const order = composeUrls.indexOf(url);
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleComposeUrl(url)}
                                    className={cn(
                                      "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                                      order >= 0 ? "border-gold" : "border-border-strong hover:border-border"
                                    )}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={g.image_role} className="h-full w-full object-cover" />
                                    {order >= 0 && (
                                      <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-ink">
                                        {order + 1}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex flex-wrap items-end gap-3">
                              <div className="w-28">
                                <Label htmlFor="video-duration">Durasi/klip</Label>
                                <Select
                                  id="video-duration"
                                  value={videoDuration}
                                  onChange={(e) => setVideoDuration(Number(e.target.value))}
                                >
                                  {[3, 5, 8, 10, 12, 15].map((d) => (
                                    <option key={d} value={d}>
                                      {d}s
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="min-w-[240px] flex-1">
                                <div className="mb-1.5 flex items-center justify-between">
                                  <Label htmlFor="video-prompt" className="mb-0">
                                    Catatan Gaya (opsional, Inggris)
                                  </Label>
                                  <button
                                    type="button"
                                    onClick={handleSuggestMotion}
                                    disabled={suggestingMotion}
                                    className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-soft disabled:opacity-50"
                                  >
                                    <Sparkles className={cn("h-3 w-3", suggestingMotion && "animate-pulse")} />
                                    Sarankan (AI)
                                  </button>
                                </div>
                                <Textarea
                                  id="video-prompt"
                                  rows={2}
                                  value={videoPrompt}
                                  onChange={(e) => setVideoPrompt(e.target.value)}
                                  placeholder="Kosongkan aja kalau tidak perlu — arah gerakan tiap foto (berputar/pan-zoom) sudah otomatis. Isi cuma kalau mau tambahan mood, mis. warm golden hour lighting..."
                                />
                                <FieldHint>
                                  Badan penuh (utama/angle/seri) otomatis dapat gerakan model berputar
                                  anggun; close-up (detail, kalau ada di riwayat lama) otomatis dapat
                                  kamera pan &amp; zoom menelusuri tekstur. Teks di sini cuma ditempel
                                  sbg catatan mood tambahan, bukan pengganti arah gerakan itu. Foto
                                  Kolase Gabungan/Kolase Detail tidak bisa dipilih di sini — sudah ada
                                  logo &amp; label teks yang akan terdistorsi kalau dianimasikan.
                                </FieldHint>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                loading={submittingVideo || videoStatus === "processing"}
                                disabled={composeUrls.length === 0}
                                onClick={handleGenerateVideo}
                              >
                                <Film className="h-4 w-4" />
                                {videoStatus === "completed" ? "Generate Ulang" : "Generate"}
                              </Button>
                            </div>
                            <FieldHint>
                              {composeUrls.length} foto dipilih · total ±
                              {composeUrls.length * videoDuration} detik video
                            </FieldHint>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {availableSeriWarna.length > 0 && (
                    <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
                      <p className="mb-2 text-xs font-medium text-text">+ Tambah Warna Seri</p>
                      <p className="mb-3 text-xs text-text-faint">
                        Reuse foto warna utama, pose, model &amp; background set ini — cukup
                        upload 1 foto full body warna baru, tidak perlu generate ulang utama.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-40">
                          <Label htmlFor="add-seri-warna">Warna</Label>
                          <Select
                            id="add-seri-warna"
                            value={addSeriWarna}
                            onChange={(e) => setAddSeriWarna(e.target.value)}
                          >
                            <option value="">Pilih warna...</option>
                            {availableSeriWarna.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="w-28">
                          <ImageUploadField
                            label="Full Body"
                            folder="products"
                            value={addSeriImage}
                            onChange={setAddSeriImage}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          loading={addingSeri}
                          disabled={!addSeriWarna || !addSeriImage}
                          onClick={handleAddSeri}
                        >
                          <Plus className="h-4 w-4" />
                          Tambah
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </AppShell>
  );
}
