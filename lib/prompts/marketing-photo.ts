// "Foto Marketing AI" (Agustus 2026) — bagian dari Poster AI di Content
// Studio. Beda dari foto katalog polos (lib/prompts/nano-banana-generate.ts,
// dipakai di alur "Generate" utama): di sini INPUT-nya adalah foto produk
// yang SUDAH ADA/sudah jadi (model memakai produk, biasanya background
// studio polos), lalu di-restyle ULANG jadi momen/cerita editorial yang
// lebih hidup lewat Nano Banana Pro edit.
//
// REVISI (feedback admin): versi awal cuma mengganti BACKGROUND (kamar,
// tekstur, furniture) sambil mengunci pose 100% sama persis — hasilnya
// tetap terasa "foto produk yang ditempel background baru", bukan foto
// editorial yang hidup. Sekarang WAJAH & DETAIL PRODUK (warna/motif/
// tekstur/jahitan/hijab) tetap dikunci ketat (non-negotiable, sama seperti
// nano-banana-generate.ts klausa GARMENT FIDELITY), TAPI pose/gestur/
// framing model dibiarkan menyesuaikan cerita/momen secara natural (mis.
// berjalan, menoleh, duduk santai) — bukan lagi wajib berdiri kaku pose
// katalog. Arahan cerita/momennya (sceneIdea) datang dari
// suggestHeadline() di content-generate.ts, yang juga sudah direvisi utk
// menyarankan MOMEN NARATIF, bukan cuma deskripsi ruangan kosong.
import { fal, FAL_MODELS } from "../fal/client";
import { logAiCost } from "../cost-log";

// Nano Banana Pro edit, resolusi 1K — fal.ai TIDAK mengembalikan usage.cost
// utk endpoint image-gen ini (beda dari text-gen router), jadi dicatat pakai
// harga tetap yang SAMA dgn konstanta COST_FULL_PASS di
// app/api/generate-set/route.ts ($0.15/panggilan, lihat komentar di sana).
const NANO_BANANA_COST_USD = 0.15;

export interface GenerateMarketingPhotoInput {
  sourceImageUrl: string; // foto produk yang sudah ada (model + garment, biasanya studio polos)
  sceneDescription: string; // deskripsi scene/mood/lighting baru dari AI social media specialist (lihat suggestHeadline di content-generate.ts) atau admin
}

export interface GenerateMarketingPhotoResult {
  imageUrl: string;
  generationTimeMs: number;
}

const IDENTITY_AND_GARMENT_LOCK = [
  "You are an expert editorial fashion photo director specializing in transforming a plain studio product photo into a natural, story-driven lifestyle photograph — the kind of candid-feeling image a premium fashion brand posts on Instagram, not a static catalog shot.",
  "You are given ONE source photograph of a real woman wearing a real garment, currently photographed in a plain/studio setting, standing in a static catalog pose.",
  "TASK: reimagine this as a genuine editorial moment in the new scene described below — the same woman, wearing the exact same garment, now naturally living inside that moment/story rather than posing for a catalog photo.",
  "MUST STAY IDENTICAL (non-negotiable): her face and facial identity — face shape, eyes, eyebrows, nose, lips, jawline, skin tone, skin texture — must clearly be the same person. Her hijab/headscarf color and general style must stay the same. And reproduce the exact garment color, fabric appearance, texture, lace, embroidery, motifs, printed or woven patterns, borders, trims, stitching, seams, silhouette, and proportions exactly as shown in the source photo — do not simplify, redesign, or hallucinate any garment detail, and do not let a new pose distort or hide the garment's true construction.",
  "MAY CHANGE to fit the story (encouraged, this is the point): her exact pose, body language, gesture, gaze direction, and the framing/crop — a natural candid moment (walking, mid-turn, glancing toward something, sitting, interacting with her surroundings) is preferred over a static frontal standing pose, as long as she is unmistakably the same person wearing the unmistakably same garment.",
  "Do not add, remove, or change any accessories/jewelry already on her, and do not swap the garment for a different design.",
].join(" ");

function buildPrompt(sceneDescription: string): string {
  return [
    IDENTITY_AND_GARMENT_LOCK,
    "",
    `SCENE & STORY: ${sceneDescription}.`,
    "",
    "Bring this scene to life as a genuine editorial moment — natural implied activity, ambient life, or context (soft-focus figures, motion, environment interaction, props being used) where the scene description calls for it, rather than an empty, static, perfectly tidy room with the woman just standing in it. Blend her naturally into the scene with realistic lighting direction, color temperature, shadows, depth of field, and perspective consistent with a premium editorial fashion photograph for Instagram.",
    "",
    "PHOTOGRAPHY STYLE: photorealistic, high-end editorial fashion photography, natural and elegant, premium modest-fashion brand aesthetic. No text, no watermark, no logo anywhere in the image. Avoid an obviously AI-generated, stiff/static, or illustration/CGI look.",
    "",
    "Before finalizing, verify internally: is this still unmistakably the same woman? Does the garment still match the source photo exactly in color, pattern, embroidery, and silhouette even in the new pose? Does it feel like a real candid editorial moment rather than a product cutout pasted onto a nice background? If the garment looks even slightly different, fix it — garment fidelity always wins over pose creativity.",
    "",
    "Produce ONE final photorealistic image.",
  ].join("\n");
}

export async function generateMarketingPhoto(
  input: GenerateMarketingPhotoInput
): Promise<GenerateMarketingPhotoResult> {
  const startedAt = Date.now();

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(input.sceneDescription),
      image_urls: [input.sourceImageUrl],
      aspect_ratio: "4:5", // sama dgn rasio poster.tsx (feed Instagram 4:5)
      resolution: "1K",
      output_format: "jpeg",
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[] };
  if (!data.images?.[0]?.url) {
    throw new Error("Nano Banana tidak mengembalikan gambar");
  }
  void logAiCost({ feature: "nano_banana_marketing_photo", costUsd: NANO_BANANA_COST_USD });

  return {
    imageUrl: data.images[0].url,
    generationTimeMs: Date.now() - startedAt,
  };
}
