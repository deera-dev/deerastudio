"use client";
// Content Studio (Agustus 2026) — generate caption+hashtag Instagram dari
// foto produk yang SUDAH ADA di katalog Deera (products.image/detail/
// warna_images), simpan sbg draft, atur jadwal, lalu publish (kalau
// Instagram sudah terhubung — lihat lib/instagram/client.ts) atau salin
// manual. TIDAK generate gambar apa pun di sini — foto diambil apa adanya.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Check,
  Copy,
  Download,
  ImageIcon,
  Instagram,
  Pencil,
  Search,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  ContentPost,
  ContentPostStatus,
  ContentPostTheme,
  ContentPostType,
} from "@/types/database";

// Label & opsi lokal (BUKAN import dari lib/prompts/content-generate.ts —
// modul itu server-only, transitif import lib/fal/client.ts yang baca
// FAL_KEY; tidak boleh ikut ter-bundle ke client, sama seperti pola
// app/generate/page.tsx yang tidak pernah import lib/prompts/* langsung).
const THEME_OPTIONS: { value: ContentPostTheme; label: string }[] = [
  { value: "produk_highlight", label: "Highlight Produk" },
  { value: "tips_styling", label: "Tips & Styling" },
  { value: "brand_story", label: "Balik Layar / Brand" },
  { value: "promo", label: "Promo / CTA" },
];
const CONTENT_TYPE_OPTIONS: { value: ContentPostType; label: string }[] = [
  { value: "feed_single", label: "Feed — 1 Foto" },
  { value: "carousel", label: "Feed — Carousel" },
  { value: "reel", label: "Reel (butuh video)" },
];
const STATUS_TONE: Record<ContentPostStatus, "success" | "gold" | "danger" | "muted"> = {
  draft: "muted",
  scheduled: "gold",
  published: "success",
  failed: "danger",
};

type ProductRow = {
  kode: string;
  nama: string;
  bahan: string | null;
  image: string | null;
  detail: string[] | null;
  warna: string[] | null;
  warna_images: Record<string, { image: string }> | null;
  video: string | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// input type="datetime-local" butuh "YYYY-MM-DDTHH:mm" tanpa offset zona.
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ContentStudioPage() {
  // --- Generate caption form ---
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [contentType, setContentType] = useState<ContentPostType>("feed_single");
  const [theme, setTheme] = useState<ContentPostTheme>("produk_highlight");
  const [extraNotes, setExtraNotes] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // --- Poster AI (headline/subtitle/bottom caption dirender di atas foto) ---
  const [posterHeadline, setPosterHeadline] = useState<{ text: string; script: boolean }[]>([]);
  const [posterSubtitle, setPosterSubtitle] = useState("");
  const [posterBottomCaption, setPosterBottomCaption] = useState("");
  const [posterColors, setPosterColors] = useState<string[]>([]);
  const [posterProductCode, setPosterProductCode] = useState("");
  // Default OFF (biar poster fokus foto+headline, tidak terasa "jualan" kayak
  // flyer katalog) — admin tetap bisa nyalain manual kalau post itu memang
  // butuh info kode produk/warna (mis. tema "Highlight Produk").
  const [showProductCode, setShowProductCode] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showBottomCaption, setShowBottomCaption] = useState(false);
  const [suggestingHeadline, setSuggestingHeadline] = useState(false);
  const [renderingPoster, setRenderingPoster] = useState(false);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);

  // --- Foto Marketing AI (restyle scene/background dari foto produk yang
  // sudah ada — model & produk 100% sama, cuma suasana yang berubah) ---
  const [sceneIdea, setSceneIdea] = useState("");
  // Foto Marketing AI (v2): dulu cuma 1 hasil generate global (marketingPhotoUrl)
  // yang otomatis jadi background poster doang — slide carousel lain tetap foto
  // katalog asli, bukan hasil AI. Sekarang tiap foto yang dipilih (selectedPhotoUrls)
  // bisa di-generate ulang scene-nya SENDIRI-SENDIRI (arahan beda per foto = tiap
  // slide jadi momen cerita yang berbeda), key-nya URL foto ASLI supaya regenerate
  // berikutnya tetap mulai dari foto katalog asli (bukan hasil AI sebelumnya).
  const [marketingOverrides, setMarketingOverrides] = useState<
    Record<string, { sceneIdea: string; url: string | null; generating: boolean; label?: string }>
  >({});

  function effectivePhotoUrl(url: string): string {
    return marketingOverrides[url]?.url || url;
  }
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);

  // --- Foto Gabungan Produk AI (opsional) — 2 model beda produk 1 frame ---
  const [secondProductQuery, setSecondProductQuery] = useState("");
  const [secondProductResults, setSecondProductResults] = useState<ProductRow[]>([]);
  const [loadingSecondProducts, setLoadingSecondProducts] = useState(false);
  const [secondProduct, setSecondProduct] = useState<ProductRow | null>(null);
  const [secondProductPhotoUrl, setSecondProductPhotoUrl] = useState<string | null>(null);
  const [comboSceneIdea, setComboSceneIdea] = useState("");
  const [comboPhotoUrl, setComboPhotoUrl] = useState<string | null>(null);
  const [generatingCombo, setGeneratingCombo] = useState(false);
  // kepilih begitu comboPhotoUrl "ditambahkan ke Foto" — dipakai saat simpan
  // draft (secondaryProductKodes) & saat generate caption (dikasih tau AI).
  const [comboSecondaryProduct, setComboSecondaryProduct] = useState<ProductRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function search() {
      if (!secondProductQuery.trim()) {
        setSecondProductResults([]);
        return;
      }
      setLoadingSecondProducts(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("kode, nama, bahan, image, detail, warna, warna_images, video")
        .or(`kode.ilike.%${secondProductQuery}%,nama.ilike.%${secondProductQuery}%`)
        .order("created_at", { ascending: false })
        .limit(24);
      if (!cancelled) {
        setSecondProductResults(((data as ProductRow[]) ?? []).filter((p) => p.kode !== selectedProduct?.kode));
        setLoadingSecondProducts(false);
      }
    }
    const t = setTimeout(search, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [secondProductQuery, selectedProduct?.kode]);

  function selectSecondProduct(p: ProductRow) {
    setSecondProduct(p);
    setSecondProductPhotoUrl(p.image ?? null);
    setComboPhotoUrl(null);
  }

  async function handleGenerateCombo() {
    const primaryUrl = selectedPhotoUrls[0];
    if (!primaryUrl || !secondProduct || !secondProductPhotoUrl || !comboSceneIdea.trim()) return;
    setGeneratingCombo(true);
    try {
      const res = await fetch("/api/content/generate-combo-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrlA: effectivePhotoUrl(primaryUrl),
          sourceImageUrlB: secondProductPhotoUrl,
          sceneDescription: comboSceneIdea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate foto gabungan gagal");
      setComboPhotoUrl(data.url);
      toast.success("Foto gabungan siap — cek dulu sebelum dipakai, hasil AI 2-orang kadang perlu diulang.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate foto gabungan gagal");
    } finally {
      setGeneratingCombo(false);
    }
  }

  function useComboPhotoAsSlide() {
    if (!comboPhotoUrl || !secondProduct) return;
    setSelectedPhotoUrls((prev) => (prev.includes(comboPhotoUrl) ? prev : [...prev, comboPhotoUrl]));
    setComboSecondaryProduct(secondProduct);
    toast.success("Foto gabungan ditambahkan sebagai salah satu slide");
  }

  // --- Kalender bulanan ---
  const now = new Date();
  const [monthStart, setMonthStart] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);

  // --- List semua konten ---
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [instagramConfigured, setInstagramConfigured] = useState(false);

  useEffect(() => {
    fetch("/api/content/instagram-status")
      .then((r) => r.json())
      .then((d) => setInstagramConfigured(Boolean(d.configured)))
      .catch(() => setInstagramConfigured(false));
  }, []);

  async function loadPosts() {
    setLoadingPosts(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("content_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setPosts((data as ContentPost[]) ?? []);
    setLoadingPosts(false);
  }

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function search() {
      setLoadingProducts(true);
      const supabase = createClient();
      const base = supabase
        .from("products")
        .select("kode, nama, bahan, image, detail, warna, warna_images, video");
      const { data } = productQuery.trim()
        ? await base
            .or(`kode.ilike.%${productQuery}%,nama.ilike.%${productQuery}%`)
            .order("created_at", { ascending: false })
            .limit(150)
        : await base.order("created_at", { ascending: false }).limit(150);
      if (!cancelled) {
        setProductResults((data as ProductRow[]) ?? []);
        setLoadingProducts(false);
      }
    }
    const t = setTimeout(search, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productQuery]);

  // Auto-promosi Format ke Carousel begitu 2+ foto terpilih — pasangan dari
  // fix di togglePhoto() di atas, supaya admin tidak perlu ingat urutan
  // "ganti Format dulu baru pilih foto".
  useEffect(() => {
    if (selectedPhotoUrls.length > 1 && contentType === "feed_single") {
      setContentType("carousel");
    }
  }, [selectedPhotoUrls.length, contentType]);

  function selectProduct(p: ProductRow) {
    setSelectedProduct(p);
    setSelectedPhotoUrls(p.image ? [p.image] : []);
    setGeneratedCaption("");
    setGeneratedHashtags("");
    setPosterHeadline([]);
    setPosterSubtitle("");
    setPosterBottomCaption("");
    setPosterColors([]);
    setPosterProductCode("");
    setPosterPreviewUrl(null);
    setShowProductCode(false);
    setShowColors(false);
    setShowBottomCaption(false);
    setSceneIdea("");
    setMarketingOverrides({});
    setSecondProduct(null);
    setSecondProductQuery("");
    setSecondProductPhotoUrl(null);
    setComboSceneIdea("");
    setComboPhotoUrl(null);
    setComboSecondaryProduct(null);
  }

  function photoOptions(p: ProductRow): { label: string; url: string }[] {
    const opts: { label: string; url: string }[] = [];
    if (p.image) opts.push({ label: "Utama", url: p.image });
    (p.detail ?? []).forEach((url, i) => opts.push({ label: `Detail ${i + 1}`, url }));
    Object.entries(p.warna_images ?? {}).forEach(([warna, v]) => {
      if (v?.image) opts.push({ label: `Warna: ${warna}`, url: v.image });
    });
    return opts;
  }

  // Foto picker SELALU multi-select (tidak lagi tergantung urutan klik vs
  // ganti Format) — sebelumnya kalau admin klik beberapa foto SEBELUM ganti
  // Format ke Carousel (state awal "feed_single"), tiap klik cuma REPLACE
  // pilihan sebelumnya, jadi pas akhirnya ganti ke Carousel cuma kebawa 1
  // foto. Sekarang klik selalu menambah/menghapus dari daftar (kecuali utk
  // "reel" yg tetap 1 foto karena reel pakai video, bukan multi-foto), dan
  // Format otomatis kepromosikan ke Carousel begitu 2+ foto terpilih (lihat
  // useEffect di bawah) — tidak perlu lagi ganti Format duluan.
  function togglePhoto(url: string) {
    if (contentType === "reel") {
      setSelectedPhotoUrls([url]);
      return;
    }
    setSelectedPhotoUrls((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= 10) return prev;
      return [...prev, url];
    });
  }

  async function handleSuggestHeadline() {
    if (!selectedProduct) return;
    setSuggestingHeadline(true);
    try {
      const res = await fetch("/api/content/suggest-headline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          theme,
          extraNotes: extraNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Saran headline gagal");
      setPosterHeadline(
        (data.headline as { text: string; script?: boolean }[]).map((l) => ({
          text: l.text,
          script: Boolean(l.script),
        }))
      );
      setPosterSubtitle(data.subtitle ?? "");
      setPosterBottomCaption(data.bottomCaption ?? "");
      setPosterColors((data.colors as string[]) ?? []);
      setPosterProductCode(data.productCode ?? selectedProduct.kode);
      setPosterPreviewUrl(null);
      setSceneIdea(data.sceneIdea ?? "");
      setMarketingOverrides({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saran headline gagal");
    } finally {
      setSuggestingHeadline(false);
    }
  }

  function slotSceneIdea(url: string): string {
    return marketingOverrides[url]?.sceneIdea ?? sceneIdea;
  }

  function updateSlotSceneIdea(url: string, text: string) {
    setMarketingOverrides((prev) => ({
      ...prev,
      [url]: {
        sceneIdea: text,
        url: prev[url]?.url ?? null,
        generating: prev[url]?.generating ?? false,
        label: prev[url]?.label,
      },
    }));
  }

  function resetMarketingOverride(url: string) {
    setMarketingOverrides((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
    setPosterPreviewUrl(null);
  }

  // "Generate Alur Cerita" — beda dari generate per-foto di atas (yang
  // masing-masing berdiri sendiri): ini SATU pemanggilan AI yang sadar akan
  // SEMUA slide sekaligus, dirancang supaya tiap slide jadi beat cerita yang
  // beda tapi tetap 1 alur yang nyambung (bukan 3 foto random yang mirip).
  // Hasilnya cuma ngisi teks arahan tiap slide (marketingOverrides[...].sceneIdea)
  // — admin tetap review/edit dulu sebelum klik generate per foto.
  async function handleSuggestStoryboard() {
    if (!selectedProduct || selectedPhotoUrls.length < 2) return;
    setGeneratingStoryboard(true);
    try {
      const res = await fetch("/api/content/suggest-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          theme,
          extraNotes: extraNotes || undefined,
          sceneCount: selectedPhotoUrls.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate alur cerita gagal");
      const scenes = data.scenes as { label: string; sceneIdea: string }[];
      setMarketingOverrides((prev) => {
        const next = { ...prev };
        selectedPhotoUrls.forEach((url, i) => {
          const scene = scenes[i];
          if (!scene) return;
          next[url] = {
            sceneIdea: scene.sceneIdea,
            url: next[url]?.url ?? null,
            generating: false,
            label: scene.label,
          };
        });
        return next;
      });
      toast.success("Alur cerita siap — review arahan tiap foto lalu generate satu-satu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate alur cerita gagal");
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  async function handleGenerateMarketingPhoto(sourceUrl: string) {
    const scene = slotSceneIdea(sourceUrl);
    if (!selectedProduct || !scene.trim()) return;
    setMarketingOverrides((prev) => ({
      ...prev,
      [sourceUrl]: { sceneIdea: scene, url: prev[sourceUrl]?.url ?? null, generating: true },
    }));
    try {
      const res = await fetch("/api/content/generate-marketing-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrl: sourceUrl,
          sceneDescription: scene,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate foto marketing gagal");
      setMarketingOverrides((prev) => ({ ...prev, [sourceUrl]: { sceneIdea: scene, url: data.url, generating: false } }));
      setPosterPreviewUrl(null);
      toast.success("Foto marketing baru siap dipakai");
    } catch (err) {
      setMarketingOverrides((prev) => ({
        ...prev,
        [sourceUrl]: { sceneIdea: scene, url: prev[sourceUrl]?.url ?? null, generating: false },
      }));
      toast.error(err instanceof Error ? err.message : "Generate foto marketing gagal");
    }
  }

  function updatePosterLine(i: number, patch: Partial<{ text: string; script: boolean }>) {
    setPosterHeadline((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setPosterPreviewUrl(null);
  }

  function addPosterLine() {
    setPosterHeadline((prev) => (prev.length >= 3 ? prev : [...prev, { text: "", script: false }]));
  }

  function removePosterLine(i: number) {
    setPosterHeadline((prev) => prev.filter((_, idx) => idx !== i));
    setPosterPreviewUrl(null);
  }

  async function handleRenderPoster() {
    if (!selectedProduct || selectedPhotoUrls.length === 0) return;
    const headline = posterHeadline.filter((l) => l.text.trim());
    if (headline.length === 0) {
      toast.error("Isi minimal 1 baris headline dulu");
      return;
    }
    setRenderingPoster(true);
    try {
      const res = await fetch("/api/content/render-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl: effectivePhotoUrl(selectedPhotoUrls[0]),
          headline,
          subtitle: posterSubtitle || undefined,
          productCode: posterProductCode || selectedProduct.kode,
          colors: posterColors,
          bottomCaption: posterBottomCaption || undefined,
          showProductCode,
          showColors,
          showBottomCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Render poster gagal");
      setPosterPreviewUrl(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render poster gagal");
    } finally {
      setRenderingPoster(false);
    }
  }

  function usePosterAsPhoto() {
    if (!posterPreviewUrl) return;
    setSelectedPhotoUrls((prev) => [posterPreviewUrl, ...prev.slice(1)]);
    toast.success("Poster dipakai sebagai foto post");
  }

  async function handleGenerateCaption() {
    if (!selectedProduct) return;
    setGenerating(true);
    try {
      // Kalau ada foto gabungan 2 produk yang sudah dipakai (comboSecondaryProduct),
      // kasih tau AI caption lewat extraNotes yang DIKIRIM (bukan textarea admin
      // yang keliatan) — supaya caption bisa nyebut produk kedua secara natural
      // tanpa perlu ubah struktur prompt generateCaption() di server.
      const comboNote = comboSecondaryProduct
        ? `Salah satu foto di post ini menampilkan produk kedua tampil bersama: ${comboSecondaryProduct.nama} (kode ${comboSecondaryProduct.kode}). Boleh disebut caption secara natural (mis. "dipadukan bersama" / "tampil berdampingan"), tanpa mengarang detail lain soal produk kedua ini.`
        : "";
      const combinedExtraNotes = [extraNotes.trim(), comboNote].filter(Boolean).join("\n\n");
      const res = await fetch("/api/content/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          theme,
          contentType,
          extraNotes: combinedExtraNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate gagal");
      setGeneratedCaption(data.caption);
      setGeneratedHashtags((data.hashtags as string[]).join(" "));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate caption gagal");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft() {
    if (!selectedProduct || !generatedCaption || selectedPhotoUrls.length === 0) return;
    setSavingDraft(true);
    try {
      const res = await fetch("/api/content-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          imageUrls: selectedPhotoUrls.map(effectivePhotoUrl),
          contentType,
          theme,
          caption: generatedCaption,
          hashtags: generatedHashtags.split(/\s+/).filter((h) => h.startsWith("#")),
          extraNotes: extraNotes || undefined,
          secondaryProductKodes: comboSecondaryProduct ? [comboSecondaryProduct.kode] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Simpan gagal");
      toast.success("Draft konten tersimpan");
      setGeneratedCaption("");
      setGeneratedHashtags("");
      setComboSecondaryProduct(null);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simpan draft gagal");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleGenerateCalendar() {
    setGeneratingCalendar(true);
    try {
      const res = await fetch("/api/content/generate-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthStart, postsPerWeek }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate kalender gagal");
      const createdCount = data.created?.length ?? 0;
      const failedCount = data.failed?.length ?? 0;
      toast.success(
        `${createdCount} draft konten dibuat${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`
      );
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate kalender gagal");
    } finally {
      setGeneratingCalendar(false);
    }
  }

  function startEdit(post: ContentPost) {
    setEditingId(post.id);
    setEditCaption(post.caption);
    setEditHashtags(post.hashtags.join(" "));
  }

  async function saveEdit(post: ContentPost) {
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption: editCaption,
          hashtags: editHashtags.split(/\s+/).filter((h) => h.startsWith("#")),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal simpan perubahan");
      toast.success("Perubahan tersimpan");
      setEditingId(null);
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan perubahan");
    }
  }

  async function handleSchedule(post: ContentPost, value: string) {
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: value ? new Date(value).toISOString() : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal atur jadwal");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal atur jadwal");
    }
  }

  async function handlePublish(post: ContentPost) {
    setPublishingId(post.id);
    try {
      const res = await fetch(`/api/content-posts/${post.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish gagal");
      toast.success("Berhasil dipublish ke Instagram");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish gagal");
    } finally {
      setPublishingId(null);
    }
  }

  async function handleDelete(post: ContentPost) {
    const ok = await confirmDialog({
      title: "Hapus draft konten?",
      description: `Konten untuk "${post.product_kode}" akan dihapus permanen.`,
      confirmLabel: "Ya, hapus",
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/content-posts/${post.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal hapus");
      await loadPosts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus");
    }
  }

  function copyCaption(post: ContentPost) {
    const text = [post.caption, post.hashtags.join(" ")].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Caption disalin ke clipboard");
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  const canGenerate = !!selectedProduct && selectedPhotoUrls.length > 0 && !generating;
  const canSaveDraft = !!generatedCaption && selectedPhotoUrls.length > 0 && !savingDraft;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Marketing"
        title="Content Studio"
        description="Generate caption & hashtag Instagram dari foto produk yang sudah ada, atur kalender bulanan, lalu publish langsung atau salin manual."
      />

      {!instagramConfigured && (
        <div className="mb-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-text-muted">
          <span className="font-medium text-gold-soft">Instagram belum terhubung.</span> Caption &
          kalender tetap bisa digenerate penuh — tinggal disalin manual. Publish langsung baru bisa
          jalan setelah Meta App Review disetujui (butuh akun Instagram Business + Meta Developer
          App), lalu isi <code className="text-xs">INSTAGRAM_ACCESS_TOKEN</code> &{" "}
          <code className="text-xs">INSTAGRAM_BUSINESS_ACCOUNT_ID</code> di <code className="text-xs">.env</code> — lihat README.
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1. Generate Caption</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div>
              <Label htmlFor="content-product">Cari produk</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <Input
                  id="content-product"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Ketik kode/nama produk"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-5">
              {loadingProducts ? (
                <p className="col-span-full py-6 text-center text-sm text-text-faint">Memuat...</p>
              ) : productResults.length === 0 ? (
                <p className="col-span-full py-6 text-center text-sm text-text-faint">
                  Tidak ada produk yang cocok.
                </p>
              ) : (
                productResults.map((p) => {
                  const active = selectedProduct?.kode === p.kode;
                  return (
                    <button
                      type="button"
                      key={p.kode}
                      onClick={() => selectProduct(p)}
                      className={cn(
                        "group relative overflow-hidden rounded-md border-2 text-left transition-colors",
                        active ? "border-gold" : "border-transparent hover:border-border-strong"
                      )}
                    >
                      <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.image}
                            alt={p.nama}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-text-faint" />
                        )}
                      </div>
                      {active && (
                        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-ink">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] leading-tight text-white">
                        {p.kode}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {selectedProduct && (
              <>
                <div>
                  <Label>Foto</Label>
                  <p className="mb-2 text-xs text-text-faint">
                    {contentType === "reel"
                      ? "Pilih 1 foto (Reel pakai video, foto ini cuma cover)."
                      : "Pilih 1 foto, atau 2-10 foto untuk Carousel (urutan klik = urutan slide) — Format otomatis berubah jadi Carousel begitu kamu pilih lebih dari 1."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {photoOptions(selectedProduct).map((opt) => {
                      const idx = selectedPhotoUrls.indexOf(opt.url);
                      const active = idx >= 0;
                      return (
                        <button
                          key={opt.url}
                          type="button"
                          onClick={() => togglePhoto(opt.url)}
                          className={cn(
                            "relative h-16 w-16 overflow-hidden rounded-md border-2 transition-colors",
                            active ? "border-gold" : "border-border-strong hover:border-text-faint"
                          )}
                          title={opt.label}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={opt.url}
                            alt={opt.label}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                          {active && contentType === "carousel" && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-medium text-ink">
                              {idx + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-3">
                  <Label className="!mb-0">Foto Gabungan Produk (AI, opsional)</Label>
                  <FieldHint>
                    Gabungkan foto produk ini dengan foto produk LAIN jadi satu frame baru — seolah 2
                    model tampil bersama (mis. &quot;dipadukan bersama&quot; / mix and match 2 koleksi). Ini fitur
                    eksperimental: menggabungkan 2 wajah + 2 baju berbeda lebih sulit buat AI dibanding
                    restyle 1 foto, jadi review hasilnya baik-baik, generate ulang kalau ada yang meleset.
                  </FieldHint>

                  {!secondProduct ? (
                    <div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                        <Input
                          value={secondProductQuery}
                          onChange={(e) => setSecondProductQuery(e.target.value)}
                          placeholder="Cari produk kedua (kode/nama)"
                          className="pl-9"
                        />
                      </div>
                      {secondProductQuery.trim() && (
                        <div className="mt-2 grid max-h-56 grid-cols-4 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-6">
                          {loadingSecondProducts ? (
                            <p className="col-span-full py-4 text-center text-xs text-text-faint">Memuat...</p>
                          ) : secondProductResults.length === 0 ? (
                            <p className="col-span-full py-4 text-center text-xs text-text-faint">
                              Tidak ada produk yang cocok.
                            </p>
                          ) : (
                            secondProductResults.map((p) => (
                              <button
                                type="button"
                                key={p.kode}
                                onClick={() => selectSecondProduct(p)}
                                className="group relative overflow-hidden rounded-md border-2 border-transparent text-left transition-colors hover:border-border-strong"
                              >
                                <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
                                  {p.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={p.image}
                                      alt={p.nama}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-5 w-5 text-text-faint" />
                                  )}
                                </div>
                                <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] leading-tight text-white">
                                  {p.kode}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={secondProductPhotoUrl || secondProduct.image || ""}
                            alt={secondProduct.nama}
                            className="h-12 w-12 rounded-md border border-border-strong object-cover"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-text">{secondProduct.kode}</span>
                            <span className="text-xs text-text-faint">{secondProduct.nama}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSecondProduct(null);
                            setSecondProductQuery("");
                            setSecondProductPhotoUrl(null);
                            setComboPhotoUrl(null);
                          }}
                          className="text-xs text-text-faint hover:text-danger"
                        >
                          Ganti produk
                        </button>
                      </div>

                      {photoOptions(secondProduct).length > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {photoOptions(secondProduct).map((opt) => (
                            <button
                              key={opt.url}
                              type="button"
                              onClick={() => {
                                setSecondProductPhotoUrl(opt.url);
                                setComboPhotoUrl(null);
                              }}
                              title={opt.label}
                              className={cn(
                                "h-12 w-12 overflow-hidden rounded-md border-2 transition-colors",
                                secondProductPhotoUrl === opt.url
                                  ? "border-gold"
                                  : "border-border-strong hover:border-text-faint"
                              )}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={opt.url}
                                alt={opt.label}
                                loading="lazy"
                                decoding="async"
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      <Textarea
                        rows={2}
                        value={comboSceneIdea}
                        onChange={(e) => {
                          setComboSceneIdea(e.target.value);
                          setComboPhotoUrl(null);
                        }}
                        placeholder="mis. two friends laughing together while walking through a sunlit garden path"
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          loading={generatingCombo}
                          disabled={!comboSceneIdea.trim() || selectedPhotoUrls.length === 0}
                          onClick={handleGenerateCombo}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {comboPhotoUrl ? "Generate Ulang" : "Generate Foto Gabungan (AI)"}
                        </Button>
                      </div>

                      {comboPhotoUrl && (
                        <div className="flex flex-col gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={comboPhotoUrl}
                            alt="Foto gabungan hasil AI"
                            className="w-full max-w-[220px] self-center rounded-md border border-border-strong"
                          />
                          <Button type="button" size="sm" onClick={useComboPhotoAsSlide}>
                            Tambahkan ke Foto
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="content-type">Format</Label>
                    <Select
                      id="content-type"
                      value={contentType}
                      onChange={(e) => {
                        const v = e.target.value as ContentPostType;
                        setContentType(v);
                        if (v !== "carousel") setSelectedPhotoUrls((prev) => prev.slice(0, 1));
                      }}
                    >
                      {CONTENT_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="content-theme">Tema</Label>
                    <Select
                      id="content-theme"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as ContentPostTheme)}
                    >
                      {THEME_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="content-notes">Catatan tambahan (opsional)</Label>
                  <Textarea
                    id="content-notes"
                    rows={2}
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder='Info nyata yang boleh dipakai AI, mis. "promo 15% sampai 31 Agustus"'
                  />
                  <FieldHint>
                    AI TIDAK akan mengarang diskon/testimoni/klaim apa pun di luar yang kamu tulis di sini.
                  </FieldHint>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="!mb-0">Poster AI (opsional)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      loading={suggestingHeadline}
                      onClick={handleSuggestHeadline}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {posterHeadline.length ? "Sarankan Ulang" : "Sarankan Headline"}
                    </Button>
                  </div>
                  <FieldHint>
                    AI menyarankan headline/mood untuk poster foto (bukan klaim produk). Kode produk & warna
                    diambil otomatis dari data asli, bukan dari AI.
                  </FieldHint>

                  {posterHeadline.length > 0 && (
                    <>
                      <div className="flex flex-col gap-2">
                        {posterHeadline.map((line, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Input
                              value={line.text}
                              onChange={(e) => updatePosterLine(i, { text: e.target.value })}
                              placeholder={`Baris ${i + 1}`}
                              className={cn(line.script && "italic")}
                            />
                            <button
                              type="button"
                              onClick={() => updatePosterLine(i, { script: !line.script })}
                              className={cn(
                                "shrink-0 rounded-md border px-2 py-2 text-[10px] font-medium uppercase tracking-wide",
                                line.script
                                  ? "border-gold text-gold-soft"
                                  : "border-border-strong text-text-faint"
                              )}
                              title="Toggle font aksen tulisan tangan"
                            >
                              Script
                            </button>
                            <button
                              type="button"
                              onClick={() => removePosterLine(i)}
                              className="shrink-0 text-text-faint hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        {posterHeadline.length < 3 && (
                          <Button type="button" size="sm" variant="ghost" onClick={addPosterLine}>
                            + Tambah baris
                          </Button>
                        )}
                      </div>

                      {sceneIdea && selectedPhotoUrls.length > 0 && (
                        <div className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="!mb-0">Foto Marketing AI (opsional)</Label>
                            {selectedPhotoUrls.length > 1 && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                loading={generatingStoryboard}
                                onClick={handleSuggestStoryboard}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                Generate Alur Cerita
                              </Button>
                            )}
                          </div>
                          <FieldHint>
                            Tiap foto yang kamu pilih di atas bisa di-generate ULANG suasana/scene-nya
                            (model & baju tetap 100% sama). Klik satu-satu kalau mau atur sendiri, atau
                            klik &quot;Generate Alur Cerita&quot; supaya AI merancang SATU cerita yang nyambung utk
                            semua slide sekaligus (tiap slide beda momen, tapi tetap 1 alur yang sama) —
                            baru review/edit arahannya sebelum generate tiap foto.
                          </FieldHint>
                          <div className="flex flex-col gap-3">
                            {selectedPhotoUrls.map((url, i) => {
                              const slot = marketingOverrides[url];
                              const scene = slotSceneIdea(url);
                              return (
                                <div
                                  key={url}
                                  className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row"
                                >
                                  <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={slot?.url || url}
                                      alt={`Foto ${i + 1}`}
                                      loading="lazy"
                                      decoding="async"
                                      className="h-16 w-16 rounded-md border border-border-strong object-cover"
                                    />
                                    <span className="text-center text-[10px] leading-tight text-text-faint">
                                      {i === 0 ? "Foto 1 (bg poster)" : `Foto ${i + 1}`}
                                      {slot?.label ? ` — ${slot.label}` : ""}
                                    </span>
                                  </div>
                                  <div className="flex flex-1 flex-col gap-2">
                                    <Textarea
                                      rows={2}
                                      value={scene}
                                      onChange={(e) => updateSlotSceneIdea(url, e.target.value)}
                                      placeholder="mis. warm minimalist living room, golden hour window light"
                                    />
                                    <div className="flex items-center gap-3">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        loading={slot?.generating}
                                        disabled={!scene.trim()}
                                        onClick={() => handleGenerateMarketingPhoto(url)}
                                      >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {slot?.url ? "Generate Ulang" : "Generate Foto Ini (AI)"}
                                      </Button>
                                      {slot?.url && (
                                        <button
                                          type="button"
                                          onClick={() => resetMarketingOverride(url)}
                                          className="text-xs text-text-faint hover:text-danger"
                                        >
                                          Pakai foto asli
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="poster-subtitle">Subtitle</Label>
                        <Input
                          id="poster-subtitle"
                          value={posterSubtitle}
                          onChange={(e) => {
                            setPosterSubtitle(e.target.value);
                            setPosterPreviewUrl(null);
                          }}
                          placeholder="mis. Aurora x Jasmine"
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-text-muted">
                        <input
                          type="checkbox"
                          checked={showBottomCaption}
                          onChange={(e) => {
                            setShowBottomCaption(e.target.checked);
                            setPosterPreviewUrl(null);
                          }}
                        />
                        Tampilkan caption bar bawah
                      </label>
                      {showBottomCaption && (
                        <Textarea
                          rows={2}
                          value={posterBottomCaption}
                          onChange={(e) => {
                            setPosterBottomCaption(e.target.value);
                            setPosterPreviewUrl(null);
                          }}
                          placeholder="Kalimat pendek di bar bawah poster"
                        />
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={showProductCode}
                            onChange={(e) => {
                              setShowProductCode(e.target.checked);
                              setPosterPreviewUrl(null);
                            }}
                          />
                          Product code
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={showColors}
                            disabled={posterColors.length === 0}
                            onChange={(e) => {
                              setShowColors(e.target.checked);
                              setPosterPreviewUrl(null);
                            }}
                          />
                          Colour available {posterColors.length > 0 ? `(${posterColors.length})` : "(tidak ada data warna)"}
                        </label>
                      </div>

                      <Button type="button" variant="outline" loading={renderingPoster} onClick={handleRenderPoster}>
                        <ImageIcon className="h-4 w-4" />
                        {posterPreviewUrl ? "Render Ulang Preview" : "Render Preview"}
                      </Button>

                      {posterPreviewUrl && (
                        <div className="flex flex-col gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={posterPreviewUrl}
                            alt="Preview poster"
                            className="w-full max-w-[280px] self-center rounded-md border border-border-strong"
                          />
                          <Button type="button" size="sm" onClick={usePosterAsPhoto}>
                            Pakai sebagai foto post
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <Button type="button" loading={generating} disabled={!canGenerate} onClick={handleGenerateCaption}>
                  <Sparkles className="h-4 w-4" />
                  {generatedCaption ? "Generate Ulang" : "Generate Caption"}
                </Button>

                {generatedCaption && (
                  <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
                    <div>
                      <Label htmlFor="content-caption">Caption</Label>
                      <Textarea
                        id="content-caption"
                        rows={6}
                        value={generatedCaption}
                        onChange={(e) => setGeneratedCaption(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="content-hashtags">Hashtag</Label>
                      <Textarea
                        id="content-hashtags"
                        rows={2}
                        value={generatedHashtags}
                        onChange={(e) => setGeneratedHashtags(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="outline" loading={savingDraft} disabled={!canSaveDraft} onClick={handleSaveDraft}>
                      Simpan sebagai Draft
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Kalender Konten Bulanan</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Generate banyak draft sekaligus, tersebar sepanjang bulan — rotasi produk yang sudah
              punya foto x 4 tema. Tiap post tetap draft (belum publish), review dulu di daftar di
              bawah sebelum kamu jadwalkan/publish.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cal-month">Bulan</Label>
                <Input
                  id="cal-month"
                  type="month"
                  value={monthStart.slice(0, 7)}
                  onChange={(e) => setMonthStart(`${e.target.value}-01`)}
                />
              </div>
              <div>
                <Label htmlFor="cal-freq">Post per minggu</Label>
                <Select
                  id="cal-freq"
                  value={postsPerWeek}
                  onChange={(e) => setPostsPerWeek(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}x / minggu
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="button" variant="outline" loading={generatingCalendar} onClick={handleGenerateCalendar}>
              <Calendar className="h-4 w-4" />
              Generate Kalender Bulan Ini
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>3. Semua Konten</CardTitle>
        </CardHeader>
        <CardBody>
          {loadingPosts ? (
            <p className="py-6 text-center text-sm text-text-faint">Memuat...</p>
          ) : posts.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-faint">Belum ada konten dibuat.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {posts.map((post) => {
                const isEditing = editingId === post.id;
                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row"
                  >
                    <div className="flex shrink-0 gap-1.5">
                      {post.image_urls.slice(0, 3).map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20"
                        />
                      ))}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text">{post.product_kode}</span>
                        <Badge tone={STATUS_TONE[post.status]}>{post.status}</Badge>
                        {post.theme && (
                          <span className="text-xs text-text-faint">
                            {THEME_OPTIONS.find((t) => t.value === post.theme)?.label ?? post.theme}
                          </span>
                        )}
                        <span className="text-xs text-text-faint">
                          {CONTENT_TYPE_OPTIONS.find((t) => t.value === post.content_type)?.label}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="mt-2 flex flex-col gap-2">
                          <Textarea rows={4} value={editCaption} onChange={(e) => setEditCaption(e.target.value)} />
                          <Textarea rows={2} value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={() => saveEdit(post)}>
                              Simpan
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Batal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 whitespace-pre-line text-sm text-text-muted">{post.caption}</p>
                      )}

                      {post.error_message && (
                        <p className="mt-1.5 text-xs text-danger">{post.error_message}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {post.status !== "published" && (
                          <Input
                            type="datetime-local"
                            value={toDatetimeLocalValue(post.scheduled_at)}
                            onChange={(e) => handleSchedule(post, e.target.value)}
                            className="!w-auto text-xs"
                          />
                        )}
                        {post.status === "published" && post.published_at && (
                          <span className="text-xs text-text-faint">
                            Published {formatDateTime(post.published_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-row gap-1.5 sm:flex-col">
                      {post.status !== "published" && !isEditing && (
                        <button
                          type="button"
                          onClick={() => startEdit(post)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
                          title="Edit caption"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => copyCaption(post)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
                        title="Salin caption"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadImage(post.image_urls[0], `${post.product_kode}-${post.id}.jpg`)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold"
                        title="Download foto"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {post.status !== "published" && (
                        <button
                          type="button"
                          onClick={() => handlePublish(post)}
                          disabled={publishingId === post.id}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold disabled:opacity-50"
                          title={instagramConfigured ? "Publish ke Instagram" : "Instagram belum terhubung"}
                        >
                          {publishingId === post.id ? (
                            <UploadCloud className="h-4 w-4 animate-pulse" />
                          ) : (
                            <Instagram className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      {post.status !== "published" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(post)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-danger"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </AppShell>
  );
}
