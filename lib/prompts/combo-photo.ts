// "Foto Gabungan Produk AI" (Agustus 2026) — bagian dari Content Studio,
// beda dari marketing-photo.ts (restyle 1 foto/1 model) — ini MENGGABUNGKAN
// 2 foto produk yang SUDAH ADA (masing-masing 1 model + 1 garment) jadi SATU
// frame baru, seolah 2 model itu difoto bersama di momen/scene yang sama.
// Dipakai kalau admin mau highlight 2 produk sekaligus dalam 1 foto (mis.
// "mix and match" / dua sahabat / dua looks bersisian) — brand-awareness
// lebih tinggi drpd 2 foto terpisah karena kerasa "editorial", bukan katalog.
//
// CATATAN JUJUR (penting utk ekspektasi admin): compositing 2 wajah + 2
// garment berbeda dalam 1 frame baru jauh LEBIH SULIT & LEBIH BERISIKO buat
// model gambar dibanding restyle 1 foto (marketing-photo.ts) — kemungkinan
// hasil kurang sempurna (wajah/detail baju sedikit meleset) lebih tinggi.
// Rekomendasikan admin review ketat before-pakai, generate ulang kalau perlu.
import { fal, FAL_MODELS } from "../fal/client";

export interface GenerateComboPhotoInput {
  sourceImageUrlA: string; // foto produk 1 (model A + garment A), sudah ada
  sourceImageUrlB: string; // foto produk 2 (model B + garment B), sudah ada
  sceneDescription: string; // deskripsi scene/momen baru tempat keduanya "difoto bersama"
}

export interface GenerateComboPhotoResult {
  imageUrl: string;
  generationTimeMs: number;
}

const DUAL_IDENTITY_AND_GARMENT_LOCK = [
  "You are an expert editorial fashion photo director. You are given TWO separate source photographs, each showing ONE real woman wearing ONE real garment (Photo A and Photo B are two different women, two different garments, currently photographed separately in plain/studio settings).",
  "TASK: compose a SINGLE new photorealistic photograph that shows BOTH women together in the SAME new scene/moment described below, as if they had been photographed together at the same time and place — like two friends or two models appearing side by side in one premium editorial fashion photograph.",
  "MUST STAY IDENTICAL for the woman from Photo A (non-negotiable): her face and facial identity (face shape, eyes, eyebrows, nose, lips, jawline, skin tone, skin texture), her hijab/headscarf color and general style, and the exact garment from Photo A — color, fabric, texture, lace, embroidery, motifs, patterns, trims, stitching, silhouette, proportions — reproduced exactly, not redesigned or simplified.",
  "MUST STAY IDENTICAL for the woman from Photo B (non-negotiable, same rules): her face and facial identity, her hijab/headscarf color and style, and the exact garment from Photo B reproduced exactly.",
  "Do not blend, mix, or swap any facial features or garment details between the two women — each keeps HER OWN face and HER OWN garment exactly as shown in her respective source photo.",
  "MAY CHANGE to fit the composed scene (encouraged): both women's pose, body language, gesture, gaze direction, their positions/framing relative to each other, and how they interact (standing together, walking side by side, sitting and chatting, etc.) — a natural, candid-feeling composition is preferred over two stiff catalog poses simply pasted next to each other.",
  "The lighting, color grade, shadows, and perspective on both women must be consistent with each other and with the new scene, as if genuinely photographed together in one shot.",
].join(" ");

function buildPrompt(sceneDescription: string): string {
  return [
    DUAL_IDENTITY_AND_GARMENT_LOCK,
    "",
    `SCENE & STORY: ${sceneDescription}.`,
    "",
    "Bring this scene to life as a genuine editorial moment featuring both women together — natural implied activity, ambient life, or context where the scene description calls for it, rather than an empty, static studio backdrop. Photorealistic, high-end editorial fashion photography, premium modest-fashion brand aesthetic. No text, no watermark, no logo anywhere in the image.",
    "",
    "Before finalizing, verify internally: are these still unmistakably the same two women from Photo A and Photo B? Does each garment still match its own source photo exactly in color, pattern, embroidery, and silhouette? Does it look like one real photograph of two people together, not two images crudely merged? If any face or garment detail drifted, fix it — identity and garment fidelity for BOTH women always wins over composition creativity.",
    "",
    "Produce ONE final photorealistic image containing both women together in the same frame.",
  ].join("\n");
}

export async function generateComboPhoto(
  input: GenerateComboPhotoInput
): Promise<GenerateComboPhotoResult> {
  const startedAt = Date.now();

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(input.sceneDescription),
      image_urls: [input.sourceImageUrlA, input.sourceImageUrlB],
      aspect_ratio: "4:5",
      resolution: "1K",
      output_format: "jpeg",
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[] };
  if (!data.images?.[0]?.url) {
    throw new Error("Nano Banana tidak mengembalikan gambar");
  }

  return {
    imageUrl: data.images[0].url,
    generationTimeMs: Date.now() - startedAt,
  };
}
