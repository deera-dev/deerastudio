// "Generate Bebas" (Agustus 2026) — admin: "saya mau ada 1 halaman lagi,
// baru, yaitu saya bisa generate foto ai apapun, tidak hanya untuk produk
// deera, samalah seperti chatgpt ataupun gemini, saya bisa upload foto
// reference dan atau memasukan prompt gambar yang saya mau". BEDA dari
// semua generator lain di app ini (nano-banana-generate.ts, color-lineup-
// generate.ts) yang SELALU membungkus prompt admin dgn banyak instruksi
// fidelity/blueprint/CORE RULE — di sini prompt admin dikirim APA ADANYA,
// tanpa modifikasi, persis spt ChatGPT/Gemini image gen. Tidak ada
// asumsi produk Deera sama sekali.
//
// Dua mode, tergantung ada/tidaknya foto referensi (lihat lib/fal/client.ts
// utk alasan kenapa 2 model ID beda dipakai):
// - referenceImageUrls kosong -> NANO_BANANA_TEXT_TO_IMAGE ("fal-ai/
//   nano-banana-pro", tanpa image_urls) — generate murni dari teks.
// - referenceImageUrls ada isinya -> NANO_BANANA ("fal-ai/nano-banana-pro/
//   edit", WAJIB minimal 1 image_urls) — edit/kombinasikan foto referensi
//   sesuai prompt.
import { fal, FAL_MODELS } from "../fal/client";

// Union literal yang diterima param `aspect_ratio` Nano Banana Pro (fal
// SDK typed) — subset yang ditawarkan di UI (lihat app/generate-bebas/
// page.tsx ASPECT_OPTIONS) semuanya termasuk di sini.
export type FreeformAspectRatio =
  | "auto"
  | "21:9"
  | "16:9"
  | "3:2"
  | "4:3"
  | "5:4"
  | "1:1"
  | "4:5"
  | "3:4"
  | "2:3"
  | "9:16";

export interface FreeformGenerateInput {
  prompt: string;
  referenceImageUrls?: string[];
  aspectRatio?: FreeformAspectRatio; // default "1:1"
  seed?: number;
}

export interface FreeformGenerateResult {
  imageUrl: string;
  seed: number;
  generationTimeMs: number;
}

export async function runFreeformGenerate(
  input: FreeformGenerateInput
): Promise<FreeformGenerateResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);
  const hasReferences = (input.referenceImageUrls?.length ?? 0) > 0;

  const result = await fal.subscribe(
    hasReferences ? FAL_MODELS.NANO_BANANA : FAL_MODELS.NANO_BANANA_TEXT_TO_IMAGE,
    {
      input: {
        prompt: input.prompt,
        ...(hasReferences ? { image_urls: input.referenceImageUrls } : {}),
        aspect_ratio: input.aspectRatio ?? "1:1",
        resolution: "2K",
        output_format: "png",
        seed,
      },
      logs: false,
    }
  );

  const data = result.data as { images: { url: string }[] };

  return {
    imageUrl: data.images[0].url,
    seed,
    generationTimeMs: Date.now() - startedAt,
  };
}
