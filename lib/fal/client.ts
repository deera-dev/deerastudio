// Fal.ai SDK setup — server-only, API key tidak pernah dikirim ke browser
// (PRD §17). Dipanggil dari Route Handler / Server Action saja.
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY!,
});

export { fal };

// Model ID yang dipakai (PRD §9):
export const FAL_MODELS = {
  // MESIN UTAMA sejak Agustus 2026 ("Opsi B", lihat lib/prompts/
  // nano-banana-generate.ts): satu pemanggilan Nano Banana Pro (Gemini 3
  // Pro Image) menggantikan pipeline lama VTO+Kontext 2-tahap. Terbukti di
  // tes manual pemilik produk jauh lebih akurat menjaga motif/tekstur
  // produk, karena bisa menerima banyak foto referensi + prompt bebas
  // (tidak seperti VTO klasik yang cuma nerima 2 foto tanpa instruksi teks).
  NANO_BANANA: "fal-ai/nano-banana-pro/edit",
  // Tahap crop/zoom foto "detail" & "seri" (turunan dari foto utama) — tetap
  // pakai Kontext, murah & cukup untuk operasi reframe murni.
  KONTEXT_PRO: "fal-ai/flux-pro/kontext",
  // TIDAK DIPAKAI LAGI di pipeline utama sejak "Opsi B" — dibiarkan di sini
  // (bukan dihapus) untuk referensi/kemungkinan fallback. Lihat catatan
  // deprecation di lib/fal/vto.ts.
  VIRTUAL_TRY_ON: "fal-ai/fashn/tryon/v1.6",
  // Text-gen (Content Studio, Agustus 2026) — caption/hashtag/kalender
  // konten Instagram. "fal-ai/any-llm" (endpoint lama) sudah DEPRECATED per
  // fal.ai docs; "openrouter/router" adalah penggantinya, model string sama
  // format ("anthropic/claude-sonnet-4.5"). Reuse FAL_KEY yang sama — tidak
  // perlu vendor/API key baru. Lihat lib/fal/text.ts.
  TEXT_ROUTER: "openrouter/router",
  // Video generation (Agustus 2026) — image-to-video dari 1 foto produk.
  // Dipakai Content Studio (Reel) & "Generate Video" di History/Generate.
  // Tier Pro dipilih (bukan Standard) utk kualitas gerakan lebih halus.
  // Param `duration`: integer 3-15 (detik), default 5 — HARD CAP 15 detik
  // per 1x generate. User minta 15-20 detik; kita clamp ke 15 (maksimal
  // yang didukung API) — lihat lib/fal/video.ts utk detail clamp.
  KLING_VIDEO_PRO: "fal-ai/kling-video/v3/pro/image-to-video",
  // Gabung beberapa video jadi 1 file, URUT sesuai array video_urls —
  // dipakai fitur "video cerita gabungan" (Agustus 2026): tiap foto post
  // dianimasikan jadi 1 klip pendek (Kling, di atas) lalu SEMUA klip
  // digabung jadi satu video utuh lewat endpoint ini. Dipilih drpd
  // ffmpeg lokal supaya konsisten dgn arsitektur app ini (semua compute
  // berat didelegasikan ke fal.ai, bukan proses di server Next.js sendiri
  // — menghindari ketergantungan binary ffmpeg di environment deploy).
  FFMPEG_MERGE_VIDEOS: "fal-ai/ffmpeg-api/merge-videos",
} as const;

// Model text-gen default utk Content Studio — kualitas tinggi (bukan model
// murah/cepat) karena ini teks marketing yang akan tampil publik.
export const TEXT_MODEL_DEFAULT = "anthropic/claude-sonnet-4.5";
