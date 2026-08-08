// Tipe & konstanta bersama Content Studio — dipakai lintas hooks &
// komponen di app/content/_hooks dan app/content/_components. Dipisah dari
// page.tsx supaya satu sumber kebenaran, bukan didefinisikan ulang di tiap
// file (lihat app/content/page.tsx utk orchestrator utama).
import type { ContentPostStatus, ContentPostTheme, ContentPostType } from "@/types/database";

export type ProductRow = {
  kode: string;
  nama: string;
  bahan: string | null;
  image: string | null;
  detail: string[] | null;
  warna: string[] | null;
  warna_images: Record<string, { image: string }> | null;
  video: string | null;
};

// Maks produk yang bisa dipilih sekaligus di 1 post. 1 produk = alur normal
// (semua metadata tampil apa adanya). 2 produk = bisa juga pakai "Foto
// Gabungan" (2 model AI 1 frame). 2-5 produk = "mode grup" — konten murni
// brand awareness lintas beberapa produk sekaligus, TANPA rincian per
// produk (kode/warna/bahan disembunyikan, lihat useProductSelection).
export const MAX_SELECTED_PRODUCTS = 5;

export const THEME_OPTIONS: { value: ContentPostTheme; label: string }[] = [
  { value: "brand_awareness", label: "Brand Awareness / Cerita" },
  { value: "produk_highlight", label: "Highlight Produk" },
  { value: "tips_styling", label: "Tips & Styling" },
  { value: "brand_story", label: "Balik Layar / Brand" },
  { value: "promo", label: "Promo / CTA" },
];

export const CONTENT_TYPE_OPTIONS: { value: ContentPostType; label: string }[] = [
  { value: "feed_single", label: "Feed — 1 Foto" },
  { value: "carousel", label: "Feed — Carousel" },
  { value: "reel", label: "Reel (butuh video)" },
];

export const STATUS_TONE: Record<ContentPostStatus, "success" | "gold" | "danger" | "muted"> = {
  draft: "muted",
  scheduled: "gold",
  published: "success",
  failed: "danger",
};

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// input type="datetime-local" butuh "YYYY-MM-DDTHH:mm" tanpa offset zona.
export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type PhotoOption = { label: string; url: string; productKode: string };

export function photoOptionsForProduct(p: ProductRow): PhotoOption[] {
  const opts: PhotoOption[] = [];
  if (p.image) opts.push({ label: "Utama", url: p.image, productKode: p.kode });
  (p.detail ?? []).forEach((url, i) =>
    opts.push({ label: `Detail ${i + 1}`, url, productKode: p.kode })
  );
  Object.entries(p.warna_images ?? {}).forEach(([warna, v]) => {
    if (v?.image) opts.push({ label: `Warna: ${warna}`, url: v.image, productKode: p.kode });
  });
  return opts;
}
