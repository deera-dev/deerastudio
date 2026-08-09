// Bagian CLIENT-SAFE dari cost-log.ts — tipe, label tampilan, dan konversi
// USD->Rp yang dipakai BUKAN cuma dari server (route handler/lib/prompts),
// tapi juga dari Dashboard (Client Component, app/dashboard/page.tsx) yang
// query tabel ai_cost_log langsung lewat Supabase client browser (RLS
// SELECT sudah mengizinkan authenticated user, lihat migration
// deera_studio_ai_cost_log).
//
// SENGAJA dipisah dari lib/cost-log.ts: file itu meng-import
// createServiceRoleClient dari lib/supabase/server.ts yang pada akhirnya
// meng-import "next/headers" — kalau Dashboard (Client Component) ikut
// meng-import lib/cost-log.ts, Next.js akan build-error ("You're importing
// a component that needs next/headers, that only works in a Server
// Component"). File INI tidak boleh meng-import apa pun yang server-only.

// Kurs referensi (Rp/USD) — SAMA dengan yang dipakai di lib/fal/video.ts &
// komentar cost di app/api/generate-set/route.ts (Agustus 2026), supaya
// konsisten satu app.
const USD_TO_RP = 17900;

export function usdToRp(usd: number): number {
  return Math.round(usd * USD_TO_RP);
}

// Daftar feature tag yang dipakai di seluruh app — dikumpulkan di satu
// tempat (bukan cuma inline string) supaya gampang di-audit & label
// tampilnya konsisten (lihat FEATURE_LABELS, dipakai dashboard).
export type AiCostFeature =
  | "nano_banana_pro" // utama/angle/seri (Generate/History) — SUDAH tercatat juga di ai_generation_sets.total_cost, di-log di sini juga cuma utk breakdown per-fitur yang konsisten
  | "kontext_crop" // foto "detail" close-up (Generate/History) — idem, sudah tercatat di total_cost juga
  | "kling_video_clip" // klip video History/Content Studio (Kling 3.0 Pro)
  | "ffmpeg_merge" // gabung klip jadi 1 video — $0 per fal.ai, tetap di-log utk kelengkapan
  | "nano_banana_marketing_photo" // Content Studio — "Foto Marketing AI"
  | "nano_banana_combo_photo" // Content Studio — "Foto Gabungan Produk"
  | "text_gen_caption" // Content Studio — generate caption+hashtag
  | "text_gen_headline" // Content Studio — saran headline poster
  | "text_gen_storyboard" // Content Studio — saran alur cerita Foto Marketing AI
  | "text_gen_group_storyboard" // Content Studio — saran alur cerita Foto Gabungan Produk
  | "text_gen_bottom_caption" // Content Studio — saran caption bar bawah poster
  | "text_gen_combo_scene" // Content Studio — saran ide scene Foto Gabungan Produk
  | "text_gen_video_motion"; // History & Content Studio — saran catatan gaya video

export const FEATURE_LABELS: Record<AiCostFeature, string> = {
  nano_banana_pro: "Foto produk (Generate/History)",
  kontext_crop: "Foto close-up derivatif",
  kling_video_clip: "Klip video (Kling, Content Studio)",
  ffmpeg_merge: "Gabung video",
  nano_banana_marketing_photo: "Foto Marketing AI (Content Studio)",
  nano_banana_combo_photo: "Foto Gabungan Produk AI (Content Studio)",
  text_gen_caption: "Caption & hashtag (Content Studio)",
  text_gen_headline: "Saran headline poster",
  text_gen_storyboard: "Saran alur cerita (Foto Marketing AI)",
  text_gen_group_storyboard: "Saran alur cerita (Foto Gabungan Produk)",
  text_gen_bottom_caption: "Saran caption bar bawah poster",
  text_gen_combo_scene: "Saran ide scene (Foto Gabungan Produk)",
  text_gen_video_motion: "Saran catatan gaya video",
};
