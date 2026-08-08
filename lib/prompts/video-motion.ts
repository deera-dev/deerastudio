// Saran prompt gerakan (motion) untuk image-to-video Kling 3.0 Pro
// (lib/fal/video.ts), Agustus 2026. Dipakai DUA tempat: Content Studio
// (Reel) & "Generate Video (AI)" per foto di History/Generate — makanya
// input dibuat generik (product opsional), bukan spesifik satu fitur.
//
// PRINSIP: Kling image-to-video TIDAK mendesain ulang apa pun — foto
// sumber (produk & model) harus tetap identik persis, cuma "dihidupkan"
// lewat gerakan halus & realistis yang masuk akal utk durasi klip (kain
// bergoyang pelan, rambut/napas, pergeseran pose kecil, gerakan kamera
// lambat). LLM diinstruksikan eksplisit utk TIDAK mengarang perubahan
// scene/pakaian/wajah, dan TIDAK mengarang klaim produk yang tidak ada
// (sama seperti prinsip anti-halusinasi di content-generate.ts).
import { generateText } from "../fal/text";
import type { CaptionProductContext } from "./content-generate";

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

  const motionPrompt = result.output
    .trim()
    .replace(/^["'“]/g, "")
    .replace(/["'”]$/g, "");

  if (!motionPrompt) {
    throw new Error("AI tidak menghasilkan motion prompt yang valid, coba generate ulang");
  }

  return { motionPrompt };
}
