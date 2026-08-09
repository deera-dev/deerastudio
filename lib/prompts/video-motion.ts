// Saran prompt gerakan (motion) untuk image-to-video Kling 3.0 Pro
// (lib/fal/video.ts), Agustus 2026. Dipakai DUA tempat: Content Studio
// (Reel) & "Video Cerita Gabungan" di History — makanya input dibuat
// generik (product opsional), bukan spesifik satu fitur.
//
// PRINSIP: Kling image-to-video TIDAK mendesain ulang apa pun — foto
// sumber (produk & model) harus tetap identik persis, cuma "dihidupkan"
// lewat gerakan halus & realistis yang masuk akal utk durasi klip (kain
// bergoyang pelan, rambut/napas, pergeseran pose kecil, gerakan kamera
// lambat). LLM diinstruksikan eksplisit utk TIDAK mengarang perubahan
// scene/pakaian/wajah, dan TIDAK mengarang klaim produk yang tidak ada
// (sama seperti prinsip anti-halusinasi di content-generate.ts).
//
// REVISI Agustus 2026 v2 — admin kasih referensi video lookbook nyata
// (model turntable badan penuh + close-up manset/kerah/kancing/tekstur)
// dan minta video kombinasi kita "memperlihatkan segala detail dari
// segala angle" spt itu. MASALAH sebelumnya: satu motionPrompt yang SAMA
// dipakai literal ke SEMUA klip dalam 1 video gabungan — instruksi
// "fabric sways gently" yang pas utk foto badan penuh jadi TIDAK relevan
// kalau dipakai apa adanya di foto close-up kancing/kerah (harusnya
// kamera pan/zoom pelan menelusuri tekstur, bukan model "bergoyang").
// Solusi: buildRoleMotionPrompt() di bawah — template deterministik
// (instan, tanpa panggilan LLM) per image_role (lihat types/database.ts):
// role badan-penuh (utama/angle/seri) dapat instruksi "model berputar
// anggun ala lookbook", role "detail" dapat instruksi "kamera pan/zoom
// pelan menelusuri tekstur". Dipakai di
// app/api/generation-sets/[id]/generate-video/route.ts, SATU per klip
// sesuai role foto sumbernya masing-masing — bukan lagi 1 prompt yang
// sama utk semua klip. suggestVideoMotion() (LLM) di bawah TETAP dipakai
// apa adanya (tanpa diubah) di DUA tempat: Content Studio (sbg prompt
// literal penuh, arsitekturnya cuma 1 shared prompt/set), dan History
// (sbg catatan gaya/mood OPSIONAL yang ditempel SETELAH template
// otomatis di atas, lihat buildRoleMotionPrompt).
import { generateText } from "../fal/text";
import { logAiCost } from "../cost-log";
import type { CaptionProductContext } from "./content-generate";
import type { ImageRole } from "@/types/database";

// ── Template deterministik per role foto (REVISI v2, lihat catatan di
// atas) — TIDAK butuh panggilan LLM sama sekali, jadi instan & gratis.
// "seri" digabung ke kelompok badan-penuh karena secara visual sama
// persis dengan "utama"/"angle" (full-body, cuma beda warna produk).
const FULL_BODY_MOTION =
  "The model performs a slow, graceful runway-style turn or subtle pose shift, revealing the outfit from a slightly different angle than the still photo. The fabric and hijab flow and settle naturally with the movement. Elegant fashion lookbook camera work, soft studio lighting, steady framing, no scene changes, no outfit changes, no new objects.";

const DETAIL_CLOSEUP_MOTION =
  "Slow, smooth camera pan combined with a gentle zoom, moving across the fabric detail to reveal its texture, embroidery, buttons, or stitching up close. Soft studio light catches the material as the camera moves. Macro fashion editorial style, no distortion, no scene changes, no outfit changes.";

// "kolase_gabungan"/"kolase_detail" (Agustus 2026, "4 foto tetap", lihat
// app/api/generate-set/route.ts REVISI #7) TIDAK PERNAH benar-benar sampai
// ke sini di alur normal — kolase adalah gambar KOMPOSIT statis (ada logo
// brand & label teks "DETAIL" nempel di atasnya), menganimasikannya lewat
// Kling akan bikin logo/teks itu ikut terdistorsi gerakan kamera, jadi
// History sengaja MENGECUALIKAN kedua role ini dari daftar foto yang bisa
// dipilih utk "Video Cerita Gabungan" (lihat filter di app/history/
// page.tsx). Entri di bawah HANYA supaya Record<ImageRole,...> ini
// type-complete — kalau suatu saat filter itu terlewat, fallback ke
// template badan-penuh/detail biasa drpd crash.
const ROLE_MOTION_TEMPLATES: Record<ImageRole, string> = {
  utama: FULL_BODY_MOTION,
  angle: FULL_BODY_MOTION,
  seri: FULL_BODY_MOTION,
  detail: DETAIL_CLOSEUP_MOTION,
  kolase_gabungan: FULL_BODY_MOTION,
  kolase_detail: DETAIL_CLOSEUP_MOTION,
};

// styleNote opsional (tulisan admin, atau hasil suggestVideoMotion di
// bawah) ditempel sbg CATATAN TAMBAHAN di akhir — jadi fokus ke
// mood/lighting/atmosfer, BUKAN arah kamera/gerakan (itu sudah dikunci
// template di atas supaya konsisten & tidak bertabrakan per role).
export function buildRoleMotionPrompt(role: ImageRole, styleNote?: string): string {
  const base = ROLE_MOTION_TEMPLATES[role] ?? FULL_BODY_MOTION;
  const note = styleNote?.trim();
  return note ? `${base} Additional mood/style note: ${note}.` : base;
}

export interface SuggestVideoMotionInput {
  product?: CaptionProductContext; // opsional — kalau ada, dipakai sbg konteks brand/produk saja
  contextNote?: string; // deskripsi bebas situasi foto sumber (mis. sceneIdea foto, atau catatan admin)
  durationSeconds: number;
}

export interface SuggestVideoMotionResult {
  motionPrompt: string; // Bahasa Inggris, dipakai LANGSUNG sbg `prompt` Kling
}

const VIDEO_MOTION_SYSTEM_PROMPT = [
  "Kamu adalah sutradara video fashion top-tier yang menulis instruksi gerakan (motion prompt) untuk model image-to-video Kling, dipakai brand fashion muslim Indonesia Deera Indonesia (gamis & mukena).",
  "Kamu diberi KONTEKS sebuah foto produk fashion yang SUDAH ADA (statis) — tugasmu HANYA menulis instruksi gerakan singkat untuk 'menghidupkan' foto itu jadi klip video pendek, BUKAN mendesain ulang apa pun di dalamnya.",
  "ATURAN KERAS: instruksi TIDAK BOLEH mengubah identitas model, warna/motif/bentuk pakaian, atau lokasi/latar — anggap semua itu FIXED persis seperti di foto. Yang boleh 'bergerak' hanyalah gerakan alami & halus: kain/jilbab bergoyang pelan tertiup angin, rambut bergerak halus (kalau relevan), napas, kedipan mata, pergeseran berat badan/pose yang natural dan kecil, tangan bergerak pelan, ATAU gerakan kamera lambat (slow push-in, gentle pan, subtle parallax) — TIDAK ADA potongan adegan (cut), TIDAK ADA perubahan lokasi, TIDAK ADA objek baru muncul.",
  "Durasi klip akan diberikan dalam detik — sesuaikan cakupan gerakan supaya realistis untuk durasi sependek itu (jangan rancang gerakan yang butuh waktu lebih lama dari durasinya, mis. jangan minta 'berjalan menyeberang ruangan' untuk klip 5 detik).",
  "ATURAN ANTI-HALUSINASI (WAJIB): JANGAN mengarang detail produk/bahan/promo yang tidak ada di data yang diberikan.",
  "Balas HANYA dengan satu paragraf singkat dalam BAHASA INGGRIS (2-4 kalimat), TANPA markdown, TANPA JSON, TANPA tanda kutip di awal/akhir — teks ini akan dikirim LANGSUNG sebagai prompt ke model video.",
].join("\n");

function buildVideoMotionUserPrompt(input: SuggestVideoMotionInput): string {
  const { product, contextNote, durationSeconds } = input;
  return [
    product
      ? [
          "DATA PRODUK (konteks brand saja, jangan diklaim sbg fakta baru):",
          `- Nama: ${product.nama}`,
          product.bahan ? `- Bahan: ${product.bahan}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    contextNote?.trim() ? `KONTEKS FOTO SUMBER:\n${contextNote.trim()}` : null,
    `DURASI KLIP: ${durationSeconds} detik.`,
    "Tulis instruksi gerakan sesuai aturan di system prompt.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

export async function suggestVideoMotion(
  input: SuggestVideoMotionInput
): Promise<SuggestVideoMotionResult> {
  const result = await generateText({
    prompt: buildVideoMotionUserPrompt(input),
    systemPrompt: VIDEO_MOTION_SYSTEM_PROMPT,
    temperature: 0.8,
    maxTokens: 300,
  });
  void logAiCost({ feature: "text_gen_video_motion", costUsd: result.costUsd, note: input.product?.kode });

  const motionPrompt = result.output
    .trim()
    .replace(/^["'“]/g, "")
    .replace(/["'”]$/g, "");

  if (!motionPrompt) {
    throw new Error("AI tidak menghasilkan motion prompt yang valid, coba generate ulang");
  }

  return { motionPrompt };
}
