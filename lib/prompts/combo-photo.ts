// "Foto Gabungan Produk AI" (Agustus 2026, digeneralisasi ke N produk) —
// bagian dari Content Studio, beda dari marketing-photo.ts (restyle 1
// foto/1 model) — ini MENGGABUNGKAN 2-5 foto produk yang SUDAH ADA
// (masing-masing 1 model + 1 garment) jadi SATU frame baru, seolah semua
// model itu difoto bersama di momen/scene yang sama. Dipakai kalau admin
// pilih beberapa produk sekaligus ("mode grup", lihat
// app/content/_hooks/useGroupCombo.ts) — brand-awareness lebih tinggi drpd
// foto terpisah per produk karena kerasa "editorial", bukan katalog.
//
// CATATAN JUJUR (penting utk ekspektasi admin): compositing beberapa wajah +
// garment berbeda dalam 1 frame baru jauh LEBIH SULIT & LEBIH BERISIKO buat
// model gambar dibanding restyle 1 foto (marketing-photo.ts) — makin banyak
// orang (3-5), makin tinggi kemungkinan wajah/detail baju sedikit meleset.
// Rekomendasikan admin review ketat before-pakai, generate ulang kalau perlu.
import { fal, FAL_MODELS } from "../fal/client";
import { logAiCost } from "../cost-log";

// Sama seperti marketing-photo.ts — fal.ai tidak mengembalikan usage.cost
// utk endpoint image-gen ini, dicatat pakai harga tetap $0.15/panggilan
// (Nano Banana Pro edit, 1K).
const NANO_BANANA_COST_USD = 0.15;

export interface GenerateComboPhotoInput {
  sourceImageUrls: string[]; // 2-5 foto produk (masing-masing 1 model + garment), sudah ada
  sceneDescription: string; // deskripsi scene/momen baru tempat semua "difoto bersama"
}

export interface GenerateComboPhotoResult {
  imageUrl: string;
  generationTimeMs: number;
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth"];

function buildIdentityLockRules(count: number): string {
  const lines = [
    `You are an expert editorial fashion photo director. You are given ${count} separate source photographs, each showing ONE real woman wearing ONE real garment (Photo ${ORDINALS.slice(0, count).join(", ")} are ${count} different women with ${count} different garments, currently photographed separately in plain/studio settings).`,
    `TASK: compose a SINGLE new photorealistic photograph that shows ALL ${count} women together in the SAME new scene/moment described below, as if they had all been photographed together at the same time and place — like a group of friends or models appearing together in one premium editorial fashion photograph.`,
  ];
  for (let i = 0; i < count; i++) {
    lines.push(
      `MUST STAY IDENTICAL for the woman from Photo ${ORDINALS[i]} (non-negotiable): her face and facial identity (face shape, eyes, eyebrows, nose, lips, jawline, skin tone, skin texture), her hijab/headscarf color and general style, and the exact garment from Photo ${ORDINALS[i]} — color, fabric, texture, lace, embroidery, motifs, patterns, trims, stitching, silhouette, proportions — reproduced exactly, not redesigned or simplified.`
    );
  }
  lines.push(
    "Do not blend, mix, or swap any facial features or garment details between the women — each keeps HER OWN face and HER OWN garment exactly as shown in her respective source photo.",
    "MAY CHANGE to fit the composed scene (encouraged): every woman's pose, body language, gesture, gaze direction, their positions/framing relative to each other, and how they interact (standing together, walking side by side, sitting and chatting, arranged in a natural group composition, etc.) — a natural, candid-feeling composition is preferred over stiff catalog poses simply pasted next to each other.",
    "The lighting, color grade, shadows, and perspective on every woman must be consistent with each other and with the new scene, as if genuinely photographed together in one shot.",
    `If ${count} people is a lot to fit naturally in one frame, prefer a believable, well-composed group arrangement (mis. slightly staggered depth, natural clustering) over cramming everyone stiffly in a single flat row.`
  );
  return lines.join(" ");
}

function buildPrompt(count: number, sceneDescription: string): string {
  return [
    buildIdentityLockRules(count),
    "",
    `SCENE & STORY: ${sceneDescription}.`,
    "",
    "Bring this scene to life as a genuine editorial moment featuring everyone together — natural implied activity, ambient life, or context where the scene description calls for it, rather than an empty, static studio backdrop. Photorealistic, high-end editorial fashion photography, premium modest-fashion brand aesthetic. No text, no watermark, no logo anywhere in the image.",
    "",
    `Before finalizing, verify internally: are these still unmistakably the same ${count} women from the ${count} source photos? Does each garment still match its own source photo exactly in color, pattern, embroidery, and silhouette? Does it look like one real photograph of everyone together, not images crudely merged? If any face or garment detail drifted, fix it — identity and garment fidelity for EVERYONE always wins over composition creativity.`,
    "",
    `Produce ONE final photorealistic image containing all ${count} women together in the same frame.`,
  ].join("\n");
}

export async function generateComboPhoto(
  input: GenerateComboPhotoInput
): Promise<GenerateComboPhotoResult> {
  const startedAt = Date.now();
  const count = input.sourceImageUrls.length;

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(count, input.sceneDescription),
      image_urls: input.sourceImageUrls,
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
  void logAiCost({ feature: "nano_banana_combo_photo", costUsd: NANO_BANANA_COST_USD, note: `${count} produk` });

  return {
    imageUrl: data.images[0].url,
    generationTimeMs: Date.now() - startedAt,
  };
}
