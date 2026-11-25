"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageDown,
  Images,
  Plus,
  RefreshCw,
  Search,
  UploadCloud,
  X,
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
import type {
  BackgroundPresetRow,
  Generation,
  GenerationSet,
  GenerationSetStatus,
  ImageRole,
} from "@/types/database";

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

function displayLabel(s: { product_kode: string; sampel_nomor: string | null }) {
  return s.sampel_nomor ?? s.product_kode;
}

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
  kolase_warna: "Lineup Warna",
  kolase_pilihan: "Kolase Pilihan",
  detail: "Detail (lama)",
};

// "+ Kolase 2 Foto" (November 2026) — sumber foto yang BOLEH dipilih utk
// digabung (lihat app/api/generation-sets/[id]/collage/route.ts). Hanya
// kolase lain (kolase_gabungan/kolase_detail/kolase_pilihan) yang
// dikecualikan, supaya tidak bikin kolase-dari-kolase berlapis —
// kolase_warna (Lineup Warna) SENGAJA TETAP BOLEH dipilih, itu tepatnya
// use-case "foto tampak depan + seri warna lengkap" yang diminta admin.
const COLLAGE_SOURCE_EXCLUDED_ROLES: ImageRole[] = [
  "kolase_gabungan",
  "kolase_detail",
  "kolase_pilihan",
];

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
  const [optimizing, setOptimizing] = useState(false);
  // Daftar preset background aktif — dipakai utk pilihan Auto/Preset di
  // dialog "Generate Ulang" (lihat promptDialog di handleRegenerate &
  // components/ui/PromptDialog.tsx). Diambil sekali saat halaman dibuka,
  // sama seperti app/generate/page.tsx.
  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundPresetRow[]>([]);
  // "+ Tambah Warna Seri" — nambah warna baru ke set yang SUDAH ADA tanpa
  // re-generate utama (lihat app/api/generation-sets/[id]/add-seri/route.ts).
  const [productWarnaOptions, setProductWarnaOptions] = useState<string[]>([]);
  const [addSeriWarna, setAddSeriWarna] = useState("");
  const [addSeriImage, setAddSeriImage] = useState<string | null>(null);
  const [addingSeri, setAddingSeri] = useState(false);
  // REVISI BESAR (Agustus 2026) — fitur "Lineup Warna" pindah jadi halaman
  // baru sendiri (/lineup-warna), bukan lagi tombol di sini. Lihat
  // app/lineup-warna/page.tsx & lib/prompts/color-lineup-generate.ts.
  // "+ Kolase 2 Foto" (November 2026) — maks 2 URL, urut = kiri lalu kanan
  // (lihat app/api/generation-sets/[id]/collage/route.ts).
  const [collageUrls, setCollageUrls] = useState<string[]>([]);
  const [creatingCollage, setCreatingCollage] = useState(false);
  // Info kode+ukuran di bar bawah kolase (REVISI November 2026) — default
  // tercentang (opt-out). Ukuran TIDAK diketik manual (admin: "ukurannya
  // kok milih? kan udah ada datanya") — diambil dari products.variants
  // (sama dgn effect productWarnaOptions di bawah, query digabung jadi
  // satu).
  const [collageShowInfo, setCollageShowInfo] = useState(true);
  const [productSizes, setProductSizes] = useState<string[]>([]);
  // "Pindah Produk" (November 2026) — admin salah masukin kode produk saat
  // generate, fotonya ke-link ke kode yang salah. Dulu satu-satunya cara
  // benerin adalah generate ulang dari nol (boros kredit AI) — sekarang bisa
  // pindah set ini ke kode yang benar lewat endpoint transfer (lihat
  // app/api/generation-sets/[id]/transfer/route.ts), foto tidak disentuh.
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferQuery, setTransferQuery] = useState("");
  const [transferResults, setTransferResults] = useState<{ kode: string; nama: string }[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);

  async function load(searchTerm: string, pageIndex: number) {
    setLoading(true);
    const supabase = createClient();
    // REVISI (November 2026) — set generate utk SAMPEL (belum punya kode
    // produk, lihat app/generate/page.tsx) TETAP muncul di History: admin
    // perlu bisa revisi (regenerate) & bikin kolase hasil generate sampel
    // juga, tidak cuma sesaat di halaman Generate. Yang khusus kode katalog
    // asli (publish, pindah produk/transfer, color-lineup) disembunyikan
    // per-baris kalau product_kode null (lihat displayLabel & guard di
    // handlePublish/handleTransfer di bawah) — bukan dihilangkan dari
    // daftar riwayatnya.
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

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("ai_background_presets")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setBackgroundPresets((data as BackgroundPresetRow[]) ?? []);
    })();
  }, []);

  const selected = sets.find((s) => s.id === selectedId) ?? null;

  // Ambil daftar warna produk ini (products.warna) tiap kali pindah set —
  // dipakai buat dropdown "+ Tambah Warna Seri" di bawah, supaya admin milih
  // dari warna yang benar-benar terdaftar, bukan ketik manual (typo-prone).
  useEffect(() => {
    setAddSeriWarna("");
    setAddSeriImage(null);
    setVideoPrompt("");
    setTransferOpen(false);
    setTransferQuery("");
    setTransferResults([]);
    setCollageUrls([]);
    if (!selected || !selected.product_kode) {
      setProductWarnaOptions([]);
      setProductSizes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("warna, variants")
        .eq("kode", selected.product_kode)
        .single();
      if (cancelled) return;
      setProductWarnaOptions((data?.warna as string[] | null) ?? []);
      const variants = (data?.variants as { size: string }[] | null) ?? [];
      setProductSizes([...new Set(variants.map((v) => v.size).filter(Boolean))]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // Search kode/nama produk tujuan utk panel "Pindah Produk" — debounce sama
  // pola dgn search produk di app/generate/page.tsx.
  useEffect(() => {
    if (!transferOpen) return;
    const timer = setTimeout(async () => {
      setTransferLoading(true);
      const supabase = createClient();
      const base = supabase.from("products").select("kode, nama");
      const { data } = transferQuery.trim()
        ? await base
            .or(`kode.ilike.%${transferQuery.trim()}%,nama.ilike.%${transferQuery.trim()}%`)
            .order("kode")
            .limit(8)
        : { data: [] as { kode: string; nama: string }[] };
      setTransferResults(
        (data ?? []).filter((p) => p.kode !== selected?.product_kode)
      );
      setTransferLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [transferOpen, transferQuery, selected?.product_kode]);

  async function handleTransfer(targetKode: string, targetNama: string) {
    if (!selected || !selected.product_kode) return;
    const ok = await confirmDialog({
      title: "Pindah ke produk lain?",
      description:
        `Set ini akan pindah dari "${selected.product_kode}" ke "${targetKode}" (${targetNama}). ` +
        "Foto TIDAK digenerate ulang, hanya link kode produknya yang berubah." +
        (selected.published_at
          ? ` Set ini sudah pernah dipublish — setelah pindah, otomatis dipublish ULANG ke katalog "${targetKode}". Katalog "${selected.product_kode}" (kode lama) TIDAK otomatis dibersihkan/dikembalikan — cek manual kalau perlu.`
          : ""),
      confirmLabel: "Ya, pindahkan",
      danger: true,
    });
    if (!ok) return;

    setTransferring(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newKode: targetKode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal memindahkan produk");
      if (data.republished) {
        toast.success(`Set berhasil dipindah & dipublish ulang ke "${targetKode}"`);
      } else {
        toast.success(`Set berhasil dipindah ke "${targetKode}"`);
        if (data.republishSkippedReason) {
          toast.error(data.republishSkippedReason);
        }
      }
      setTransferOpen(false);
      setTransferQuery("");
      setTransferResults([]);
      await load(search, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memindahkan produk");
    } finally {
      setTransferring(false);
    }
  }

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
  //
  // REVISI (Agustus 2026 — admin: "di bagian generate ulang juga cuma bisa
  // upload 1 image aja, lebih bagus bisa banyak, dan ada reference dari
  // hasil yang di generate sebelumnya"): dialog sekarang bisa terima sampai
  // 3 foto referensi (referenceImageUrls, array) — hasil percobaan
  // SEBELUMNYA sendiri TIDAK perlu diupload di sini, sudah otomatis
  // disisipkan server-side dari output_image_url baris ini (lihat regenerate/
  // route.ts), jadi hint dialog disesuaikan.
  //
  // REVISI BESAR (Agustus 2026, sepaket dgn mode refine — lihat header
  // lib/prompts/nano-banana-generate.ts): dialog sekarang juga tawarkan
  // checkbox "Kunci Produk" (allowLockGarment) — kalau dicentang, koreksi
  // ini TIDAK regenerate dari flat-lay, cuma edit foto sebelumnya (garment
  // dikunci). Dikirim sbg `lockGarment` ke endpoint regenerate.
  async function handleRegenerate(genId: string) {
    if (!selected) return;
    const gen = selected.ai_generations.find((g) => g.id === genId);
    const supportsNote =
      gen?.image_role === "utama" || gen?.image_role === "angle" || gen?.image_role === "seri";

    let note: string | undefined;
    let referenceImageUrls: string[] | undefined;
    let lockGarment = false;
    let backgroundMode: "auto" | "preset" | undefined;
    let backgroundPresetId: string | undefined;
    if (supportsNote) {
      // Rekomendasi default preset saat admin pilih mode "Preset" di dialog
      // — "Fashion Show Runway" (preset spesial, lihat ai_background_presets)
      // kalau aktif, fallback ke preset pertama (alfabetis) kalau tidak ada.
      const recommended =
        backgroundPresets.find((p) => p.name === "Fashion Show Runway") ?? backgroundPresets[0];
      const result = await promptDialog({
        title: `Generate Ulang — ${ROLE_LABELS[gen!.image_role] ?? gen!.image_role}`,
        description:
          "Tulis apa yang mau diperbaiki (Inggris lebih akurat) — hasil sebelumnya otomatis jadi acuan. Kosongkan kalau cuma mau coba ulang biasa.",
        placeholder: "mis. remove the bookshelf in the background, make the pose more relaxed...",
        confirmLabel: "Generate Ulang",
        allowImage: true,
        imageLabel: "Foto Referensi Tambahan (opsional, sampai 3)",
        imageHint: "Contoh foto yang menunjukkan maksud perbaikan — bukan pengganti foto produk/model.",
        allowLockGarment: true,
        backgroundPresets: backgroundPresets.map((p) => ({ id: p.id, name: p.name })),
        recommendedBackgroundPresetId: recommended?.id,
      });
      if (result === null) return; // dibatalkan dari dialog
      note = result.note;
      referenceImageUrls = result.referenceImageUrls.length ? result.referenceImageUrls : undefined;
      lockGarment = result.lockGarment;
      backgroundMode = result.backgroundMode;
      backgroundPresetId = result.backgroundPresetId;
    }

    setRegeneratingId(genId);
    try {
      const res = await fetch(`/api/generations/${genId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note || undefined,
          referenceImageUrls,
          lockGarment,
          backgroundMode,
          backgroundPresetId,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Regenerate gagal");
      toast.success("Gambar berhasil digenerate ulang");
    } catch (err) {
      // BUG FIX (Agustus 2026 — admin: baris tetap kelihatan "processing" di
      // UI walau regenerate sudah gagal/timeout): dulu refreshOne() cuma
      // dipanggil di jalur sukses — kalau request gagal (mis. 504 dari
      // Vercel function timeout, lihat maxDuration di app/api/generations/
      // [id]/regenerate/route.ts), UI lama tetap tampil sampai admin refresh
      // manual. Sekarang refetch selalu jalan di kedua jalur supaya UI
      // langsung mencerminkan status TERKINI di DB (baik "failed" kalau
      // server sempat sempat nulis error, maupun tetap "processing" kalau
      // benar2 masih berjalan/stuck — setidaknya tidak diam2 salah tampil).
      toast.error(err instanceof Error ? err.message : "Regenerate gagal");
    } finally {
      await refreshOne(selected.id);
      setRegeneratingId(null);
    }
  }

  // "+ Kolase 2 Foto" — klik toggle, maks 2 terpilih (klik ke-3 saat sudah
  // 2 terpilih diabaikan; admin lepas salah satu dulu kalau mau ganti).
  function toggleCollageUrl(url: string) {
    setCollageUrls((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= 2) return prev;
      return [...prev, url];
    });
  }

  // Upload foto manual (bukan dari riwayat generate set ini) buat salah
  // satu panel kolase — mis. foto asli dari HP yang belum pernah di-AI,
  // dipasangkan dengan foto hasil generate. Sama aturan maks 2 dgn
  // toggleCollageUrl di atas; ImageUploadField-nya selalu kosong lagi
  // setelah upload (slot "tambah", bukan preview yang disimpan).
  function addManualCollageUrl(url: string) {
    setCollageUrls((prev) => {
      if (prev.length >= 2) {
        toast.error("Sudah 2 foto dipilih — lepas salah satu dulu.");
        return prev;
      }
      return [...prev, url];
    });
  }

  function removeCollageUrlAt(index: number) {
    setCollageUrls((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateCollage() {
    if (!selected || collageUrls.length !== 2) return;
    setCreatingCollage(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/collage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftUrl: collageUrls[0],
          rightUrl: collageUrls[1],
          kode: selected.product_kode ?? undefined,
          size: productSizes.join(" / ") || undefined,
          showInfo: collageShowInfo,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal membuat kolase");
      toast.success("Kolase berhasil dibuat");
      setCollageUrls([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat kolase");
    } finally {
      await refreshOne(selected.id);
      setCreatingCollage(false);
    }
  }

  async function handlePublish() {
    if (!selected || !selected.product_kode) return;
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

  // Backfill thumbnail foto lama (lihat app/api/admin/backfill-thumbs/route.ts):
  // loop batch kecil sampai tidak ada sisa, lalu reload supaya grid memakai
  // thumbnail baru.
  async function handleOptimizeOld() {
    setOptimizing(true);
    const toastId = toast.loading("Mengoptimalkan foto lama...");
    try {
      let processed = 0;
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/admin/backfill-thumbs", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal mengoptimalkan");
        processed += data.processed ?? 0;
        toast.loading(`Mengoptimalkan foto lama... ${processed} selesai, sisa ${data.remaining}`, {
          id: toastId,
        });
        if (!data.remaining || (data.processed === 0 && !data.errors?.length)) break;
        if (data.processed === 0) break;
      }
      toast.success(`Selesai — ${processed} foto lama dioptimalkan`, { id: toastId });
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengoptimalkan", { id: toastId });
    } finally {
      setOptimizing(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        actions={
          <Button size="sm" variant="ghost" loading={optimizing} onClick={handleOptimizeOld}>
            <ImageDown className="h-4 w-4" /> Optimalkan foto lama
          </Button>
        }
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
                        src={utama.output_thumb_url ?? utama.output_image_url}
                        loading="lazy"
                        decoding="async"
                        alt={displayLabel(set)}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{displayLabel(set)}</div>
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
                  <CardTitle>{displayLabel(selected)}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                    {!selected.product_kode && <Badge tone="muted">Sampel</Badge>}
                    {/* Publish/Pindah Produk cuma berlaku utk produk katalog asli
                        (butuh kode) — sampel belum punya kode, tidak ditampilkan. */}
                    {selected.product_kode && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTransferOpen((v) => !v)}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                          Pindah Produk
                        </Button>
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
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  {transferOpen && selected.product_kode && (
                    <div className="mb-4 rounded-lg border border-border bg-surface-2 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-text">
                          Pindah set ini ke kode produk lain
                        </p>
                        <button
                          type="button"
                          onClick={() => setTransferOpen(false)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-text"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mb-3 text-xs text-text-faint">
                        Salah masukin kode saat generate? Pindahkan set ini (sekarang di &quot;
                        {selected.product_kode}&quot;) ke kode yang benar — foto TIDAK digenerate
                        ulang sama sekali, cuma link kode produknya yang berubah.
                      </p>
                      <div className="relative mb-2 max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                        <Input
                          value={transferQuery}
                          onChange={(e) => setTransferQuery(e.target.value)}
                          placeholder="Cari kode/nama produk tujuan..."
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                      {transferLoading ? (
                        <p className="text-xs text-text-faint">Mencari...</p>
                      ) : transferQuery.trim() && transferResults.length === 0 ? (
                        <p className="text-xs text-text-faint">Tidak ada produk yang cocok.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {transferResults.map((p) => (
                            <button
                              key={p.kode}
                              type="button"
                              disabled={transferring}
                              onClick={() => handleTransfer(p.kode, p.nama)}
                              className="flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-left text-xs hover:border-gold/60 hover:bg-gold/5 disabled:opacity-50"
                            >
                              <span className="font-medium text-text">{p.kode}</span>
                              <span className="truncate text-text-faint">{p.nama}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                              src={gen.output_thumb_url ?? gen.output_image_url}
                              loading="lazy"
                              decoding="async"
                              alt={gen.image_role}
                              className="aspect-[3/4] w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div
                            className={cn(
                              "flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 overflow-y-auto p-3 text-center text-xs",
                              gen.status === "failed" ? "text-danger" : "text-text-faint"
                            )}
                          >
                            {gen.status === "failed" ? (
                              <>
                                <span className="font-medium">Gagal</span>
                                <span className="break-words text-[11px] leading-snug text-text-muted">
                                  {gen.error_message || "Tidak ada detail error dari server."}
                                </span>
                              </>
                            ) : (
                              "..."
                            )}
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
                    const collageSourcePhotos = selected.ai_generations.filter(
                      (g) =>
                        g.status === "completed" &&
                        g.output_image_url &&
                        !COLLAGE_SOURCE_EXCLUDED_ROLES.includes(g.image_role)
                    );
                    return (
                      <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text">
                          <Images className="h-3.5 w-3.5 text-gold" />
                          + Kolase 2 Foto
                        </div>
                        <p className="mb-3 text-xs text-text-faint">
                          Pilih tepat 2 foto buat digabung jadi 1 gambar berdampingan — dari
                          riwayat generate set ini, atau upload foto manual (mis. foto asli dari
                          HP yang belum pernah di-AI).
                        </p>

                        {collageSourcePhotos.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {collageSourcePhotos.map((g) => {
                              const url = g.output_image_url as string;
                              const order = collageUrls.indexOf(url);
                              return (
                                <button
                                  key={g.id}
                                  type="button"
                                  onClick={() => toggleCollageUrl(url)}
                                  title={ROLE_LABELS[g.image_role] ?? g.image_role}
                                  className={cn(
                                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                                    order >= 0
                                      ? "border-gold"
                                      : "border-border-strong hover:border-border"
                                  )}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={g.output_thumb_url ?? url}
                                    loading="lazy"
                                    decoding="async"
                                    alt={g.image_role}
                                    className="h-full w-full object-cover"
                                  />
                                  {order >= 0 && (
                                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-ink">
                                      {order + 1}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {collageUrls.length > 0 && (
                          <div className="mb-3">
                            <p className="mb-1.5 text-xs font-medium text-text-faint">
                              Foto terpilih
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {collageUrls.map((url, i) => (
                                <div
                                  key={`${url}-${i}`}
                                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 border-gold"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={url}
                                    alt={`Foto terpilih ${i + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-ink">
                                    {i + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeCollageUrlAt(i)}
                                    className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-text hover:bg-danger/80"
                                  >
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {collageUrls.length < 2 && (
                          <div className="mb-3 w-28">
                            <ImageUploadField
                              label="Upload Manual"
                              folder="collage-manual"
                              value={null}
                              onChange={(url) => url && addManualCollageUrl(url)}
                              hint="Foto dari luar riwayat (mis. HP)"
                            />
                          </div>
                        )}

                        <div className="mb-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={collageShowInfo}
                              onChange={(e) => setCollageShowInfo(e.target.checked)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-gold"
                            />
                            <span>
                              <span className="text-sm font-medium text-text">
                                Tampilkan kode &amp; ukuran
                              </span>
                              <span className="mt-0.5 block text-xs text-text-faint">
                                {selected.product_kode ? (
                                  <>
                                    Bar hijau berisi kode produk ({selected.product_kode})
                                    {productSizes.length > 0
                                      ? ` + ukuran (${productSizes.join(" / ")})`
                                      : " — produk ini belum ada data ukuran di katalog"}{" "}
                                    di bagian bawah kolase.
                                  </>
                                ) : (
                                  "Sampel belum punya kode/ukuran katalog — bar info tidak ditampilkan."
                                )}
                              </span>
                            </span>
                          </label>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          loading={creatingCollage}
                          disabled={collageUrls.length !== 2}
                          onClick={handleCreateCollage}
                        >
                          <Images className="h-4 w-4" />
                          Buat Kolase
                        </Button>
                        <FieldHint>
                          {collageUrls.length}/2 foto dipilih — foto pertama diklik jadi panel
                          kiri, kedua jadi panel kanan.
                        </FieldHint>
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
