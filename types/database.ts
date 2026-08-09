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
  // REVISI (Agustus 2026, setelah "4 foto tetap" REVISI #8 gagal — foto
  // "angle" yang seharusnya belakang malah keluar depan lagi): foto
  // referensi ASLI yang menunjukkan BELAKANG model, ditandai admin di
  // halaman Poses. Generate-set otomatis pakai pose bertanda ini utk foto
  // "angle" (bukan lagi pose depan + instruksi teks "putar ke belakang" —
  // itu tidak reliable krn model AI cenderung niru foto referensi visual
  // drpd ikutin instruksi teks). Maksimal 1 pose per model boleh true
  // (partial unique index `ai_poses_one_back_view_per_model`).
  is_back_view: boolean;
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
    detailHand?: string; // close-up pergelangan/manset tangan — BEDA dari detailSleeve (lengan/bahu)
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
  // Video "cerita gabungan" (Agustus 2026, REVISI v2) — SEMUA foto
  // terpilih dianimasikan jadi klip pendek lalu digabung URUT jadi SATU
  // video utuh (lihat lib/fal/video.ts). null di semua field berarti
  // belum pernah diminta generate video utk set ini.
  video_status: "processing" | "completed" | "failed" | null;
  video_url: string | null;
  video_error_message: string | null;
  video_started_at: string | null;
  video_clip_jobs: VideoClipJob[];
  video_merge_request_id: string | null;
  video_cost: number | null;
}

// Status 1 klip Kling individual sebelum digabung — dipakai polling utk
// reconcile progress kapan saja (termasuk setelah admin pindah halaman
// lalu balik lagi, lihat app/api/generation-sets/[id]/generate-video/).
export type VideoClipJobStatus = "queued" | "processing" | "completed" | "failed";
export interface VideoClipJob {
  requestId: string;
  sourceUrl: string; // foto sumber klip ini (salah satu ai_generations.output_image_url)
  status: VideoClipJobStatus;
  clipUrl: string | null; // URL klip Kling individual, terisi setelah status "completed"
  errorMessage?: string | null;
}

// "detail" = crop close-up (jahitan/kancing/kerah) diturunkan dari foto
// utama — SEJAK REVISI #7 (Agustus 2026, "4 foto tetap") TIDAK PERNAH lagi
// disimpan sbg baris ai_generations (lihat app/api/generate-set/route.ts);
// tipe ini dipertahankan HANYA utk baris-baris LAMA yang sudah ada di DB
// sebelum revisi itu. "angle" = foto badan penuh DARI BELAKANG — salah satu
// dari 4 deliverable set foto tetap (persis 1). REVISI #8 (Agustus 2026,
// segera setelah #7): awalnya "angle" pakai pose_id KEDUA yang beda dari
// utama (admin harus pilih dari galeri pose) — admin klarifikasi maksudnya
// cukup foto belakang, TIDAK perlu pilih pose lagi. Sekarang baris "angle"
// menyimpan pose_id yang SAMA dengan baris "utama" di set yang sama,
// dibedakan lewat flag isBackView=true saat generate (lihat
// lib/prompts/nano-banana-generate.ts & app/api/generate-set/route.ts). "seri" =
// varian WARNA lain dari produk yang sama (REVISI Agustus 2026, final/
// hemat-foto: BUKAN recolor tebakan AI dari foto utama, dan BUKAN lagi
// upload set foto lengkap per warna — admin cukup upload SATU foto
// full-body per warna lewat variant_product_images.image; referensi
// bentuk/tekstur/bordir dipakai ulang dari foto warna utama
// (ai_generation_sets.product_images). Tiap warna tetap di-generate FULL &
// independen lewat Nano Banana Pro dgn pose sama dengan utama, fitur INI
// TETAP terpisah/opsional dari 4-foto-tetap). variant_warna simpan nama
// warnanya.
//
// "kolase_gabungan"/"kolase_detail" (BARU REVISI #7, Agustus 2026) — dua
// deliverable TAMBAHAN yang membuat total set SELALU 4 foto: kolase
// gabungan (foto utama + angle disusun berdampingan + logo brand) & kolase
// detail (foto utama full-bleed + 2 inset close-up berlabel DETAIL + logo
// brand). BUKAN panggilan AI baru — cuma compositing lokal (next/og, lihat
// lib/image-template/set-collage.tsx), makanya `cost` selalu 0 utk kedua
// role ini.
export type ImageRole =
  | "utama"
  | "detail"
  | "seri"
  | "angle"
  | "kolase_gabungan"
  | "kolase_detail";
export type GenerationStatus = "queued" | "processing" | "completed" | "failed";

export interface Generation {
  id: string;
  generation_set_id: string;
  image_role: ImageRole;
  pose_id: string | null; // hanya terisi utk role "utama"/"angle" (VTO independen) — REVISI #8: "angle" simpan pose_id yg SAMA dgn "utama" di set yg sama, dibedakan lewat isBackView saat generate, bukan pose_id berbeda
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
  // Video (Agustus 2026) — animasi opsional dari foto ini via Kling 3.0
  // Pro image-to-video (lib/fal/video.ts). null di semua field berarti
  // belum pernah diminta generate video utk baris ini.
  video_url: string | null;
  video_status: GenerationStatus | null;
  video_generation_time_ms: number | null;
  video_cost: number | null;
}

// Content Studio (Agustus 2026) — konten marketing Instagram (caption,
// hashtag, kalender) digenerate dari produk yang sudah ada di katalog Deera.
// Lihat lib/prompts/content-generate.ts utk logic generate teksnya &
// lib/instagram/client.ts utk publish-nya.
export type ContentPostType = "feed_single" | "carousel" | "reel";
export type ContentPostTheme = "produk_highlight" | "tips_styling" | "brand_story" | "promo" | "brand_awareness";
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
  // Video (Agustus 2026) — opsional, hasil Content Studio "Generate Video
  // (AI)" (khusus content_type "reel"), lihat lib/fal/video.ts. null
  // berarti post ini belum/tidak punya video.
  video_url: string | null;
}
