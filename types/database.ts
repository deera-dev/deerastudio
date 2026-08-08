// Tipe TypeScript yang mencerminkan skema PRD §12. Tabel BARU AI Fashion
// Studio ditambahkan ke project Supabase Deera yang sama — tabel di bawah
// ini TIDAK termasuk tabel Deera existing (products, stok_warna, dst),
// yang didefinisikan di monorepo Deera (packages/shared).

export type LoraStatus = never; // dihapus di v0.3 — FLUX VTO tidak butuh training

export interface AiModel {
  id: string;
  name: string;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AiPose {
  id: string;
  model_id: string; // terikat ke satu model (PRD §7.3 v0.3)
  name: string;
  reference_image_url: string;
  description: string | null;
  source: "vendor_archive" | "new_shoot" | "ai_generated";
  is_active: boolean;
  created_at: string;
}

export interface BackgroundPresetRow {
  id: string;
  name: string;
  prompt_fragment: string;
  reference_image_url: string | null;
  mood_tags: string[];
  warna_affinity: string[];
  cocok_untuk_kategori: string[];
  last_used_at: string | null;
  use_count: number;
  is_active: boolean;
  created_at: string;
}

export type AccessoryCategory = "tas" | "kalung" | "cincin" | "anting";

export interface AccessoryPresetRow {
  id: string;
  category: AccessoryCategory;
  name: string;
  prompt_fragment: string;
  reference_image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export type BackgroundMode = "auto" | "preset" | "ai_improvised";
export type GenerationSetStatus =
  | "queued"
  | "processing"
  | "completed"
  | "partial"
  | "failed";

export interface GenerationSet {
  id: string;
  product_kode: string; // FK asli ke products.kode (project sama dgn Deera)
  model_id: string;
  pose_id: string;
  background_mode: BackgroundMode;
  background_preset_id: string | null;
  background_description: string | null;
  accessory_preset_ids: string[];
  product_images: {
    front: string;
    back?: string;
    detailNeck?: string;
    detailSleeve?: string;
    detailChest?: string;
    detailHem?: string;
    fullBody?: string;
  };
  product_warna: string | null;
  status: GenerationSetStatus;
  total_cost: number | null;
  published_at: string | null;
  published_image_urls: Record<string, string | string[]> | null;
  created_at: string;
}

// "detail" = crop close-up (jahitan/kancing/kerah) diturunkan dari foto
// utama. "angle" = foto badan penuh dari pose LAIN (generate independen
// dengan pose_id berbeda). "seri" = varian WARNA lain dari produk yang sama
// (REVISI Agustus 2026, final/hemat-foto: BUKAN recolor tebakan AI dari foto
// utama, dan BUKAN lagi upload set foto lengkap per warna — admin cukup
// upload SATU foto full-body per warna lewat variant_product_images.image;
// referensi bentuk/tekstur/bordir dipakai ulang dari foto warna utama
// (ai_generation_sets.product_images). Tiap warna tetap di-generate FULL &
// independen lewat Nano Banana Pro dgn pose sama dengan utama).
// variant_warna simpan nama warnanya.
export type ImageRole = "utama" | "detail" | "seri" | "angle";
export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  generation_set_id: string;
  image_role: ImageRole;
  pose_id: string | null; // hanya terisi utk role "utama"/"angle" (VTO independen)
  variant_warna: string | null; // hanya terisi utk role "seri" — nama warna varian, mis. "MERAH"
  variant_product_images: Record<string, string> | null; // hanya terisi utk role "seri" — { image: "<url foto full-body warna itu>" }, dipakai ulang saat regenerate (lihat REVISI hemat-foto)
  vto_image_url: string | null;
  output_image_url: string | null;
  has_stage2: boolean;
  status: GenerationStatus;
  generation_time_ms: number | null;
  cost: number | null;
  error_message: string | null;
  created_at: string;
}

// Content Studio (Agustus 2026) — konten marketing Instagram (caption,
// hashtag, kalender) digenerate dari produk yang sudah ada di katalog Deera.
// Lihat lib/prompts/content-generate.ts utk logic generate teksnya &
// lib/instagram/client.ts utk publish-nya.
export type ContentPostType = "feed_single" | "carousel" | "reel";
export type ContentPostTheme = "produk_highlight" | "tips_styling" | "brand_story" | "promo";
export type ContentPostStatus = "draft" | "scheduled" | "published" | "failed";

export interface ContentPost {
  id: string;
  product_kode: string;
  // Produk tambahan yang tampil di post ini (fitur "Foto Gabungan Produk AI"
  // — 2 model beda produk dalam 1 frame yang sama). product_kode tetap SATU
  // (produk utama/pertama dipilih), ini cuma daftar tambahan buat konteks
  // caption + tampilan. Kosong ([]) utk post normal 1 produk.
  secondary_product_kodes: string[];
  image_urls: string[];
  content_type: ContentPostType;
  theme: ContentPostTheme | null;
  caption: string;
  hashtags: string[];
  extra_notes: string | null;
  scheduled_at: string | null;
  status: ContentPostStatus;
  instagram_media_id: string | null;
  published_at: string | null;
  error_message: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}
