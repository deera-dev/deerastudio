// Tahap 2 (LAMA): FLUX Kontext Pro / Nano Banana — ganti background &
// tambah aksesoris pada hasil tahap 1 (PRD §7.6, default aktif sejak v0.5).
//
// STATUS (Agustus 2026, "Opsi B"): runStage2Edit() TIDAK DIPAKAI LAGI di
// pipeline utama — foto "utama"/"angle" sekarang selesai dalam 1 pemanggilan
// lewat lib/prompts/nano-banana-generate.ts. Fungsi ini dibiarkan (bukan
// dihapus) untuk referensi/fallback.
//
// runDetailCrop() TETAP DIPAKAI — foto "detail" (close-up jahitan/kancing/
// kerah) masih diturunkan dari foto "utama" yang sudah jadi lewat crop/zoom
// Kontext (murah, operasi reframe murni, tidak perlu re-render produk dari
// nol).
//
// runColorVariant() BARU (Agustus 2026) — foto "seri" TIDAK LAGI berarti
// "angle lain" (itu keliru, sudah dikoreksi user). "seri" sekarang berarti
// VARIAN WARNA lain dari produk yang sama (mis. gamis yang sama tapi warna
// merah/hitam/krem) — direcolor dari foto "utama" yang sudah jadi, bukan
// generate baru dari nol, supaya pose/model/background tetap identik dan
// cuma warna kainnya yang berubah.
import { fal, FAL_MODELS } from "../fal/client";

export interface Stage2Input {
  baseImageUrl: string; // hasil tahap 1 (VTO)
  backgroundDescription: string; // hasil composeBackground()
  productWarna?: string; // untuk kerudung & heels, auto — TIDAK ada pilihan gaya (PRD §7.4)
  accessoryPromptFragments?: string[]; // dari accessory_presets.prompt_fragment terpilih
  engine?: "kontext" | "nano-banana";
  seed?: number;
}

export interface Stage2Result {
  imageUrl: string;
  seed: number;
  generationTimeMs: number;
}

// Klausa identitas & warna ini WAJIB ada di semua prompt tahap 2 — tanpa ini
// model cenderung "mempercantik" wajah ke wajah generik dan membiarkan
// lighting mengubah persepsi warna kain (ditemukan dari tes nyata pertama:
// gamis krem berubah kuning di background lounge malam yang hangat).
const IDENTITY_AND_COLOR_LOCK =
  "Preserve the exact same person and facial identity as shown in the input image — " +
  "same face shape, same facial features, same skin tone, same expression style. " +
  "Do not beautify, restyle, or alter the face in any way. " +
  "Preserve the garment's exact original color, pattern, and fabric texture regardless " +
  "of the new lighting — the garment color must read identically to the input image, " +
  "do not let ambient or warm lighting tint or shift its true color. " +
  "Preserve every fine fabric detail exactly as it appears in the input image: " +
  "embroidery and quilting relief must stay raised/dimensional (not flattened into a " +
  "plain print), print or foil pattern scale and density must not shrink, blur, or " +
  "simplify, and the fabric's material finish and sheen (matte, satin, velvet, etc.) " +
  "must be preserved. Do not simplify, smooth over, or generic-ify any textural or " +
  "decorative detail of the garment.";

// Versi khusus utk runColorVariant() di bawah — TIDAK menyertakan klausa
// "preserve garment color" (justru kebalikannya, warna garment yang memang
// harus berubah di sini), tapi tetap kunci identitas wajah + semua elemen
// lain.
const IDENTITY_LOCK_ONLY =
  "Preserve the exact same person and facial identity as shown in the input image — " +
  "same face shape, same facial features, same skin tone, same expression style. " +
  "Do not beautify, restyle, or alter the face in any way. Do not change the pose, " +
  "background, lighting, hijab style, or any other element of the photo.";

function buildBackgroundPrompt(input: Stage2Input): string {
  const accessoryClause = input.accessoryPromptFragments?.length
    ? input.accessoryPromptFragments.join(", ")
    : "none";

  return [
    `Replace the entire background with: ${input.backgroundDescription}.`,
    "Preserve the person, the garment, pose, and all garment details exactly as in the input image.",
    IDENTITY_AND_COLOR_LOCK,
    input.productWarna
      ? `Hijab color and heels color must match the garment's primary color: ${input.productWarna}.`
      : "",
    `Add accessory if specified: ${accessoryClause}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function callKontext(
  imageUrl: string,
  prompt: string,
  engine: "kontext" | "nano-banana" | undefined,
  seed: number | undefined
): Promise<Stage2Result> {
  const startedAt = Date.now();
  const model = engine === "nano-banana" ? FAL_MODELS.NANO_BANANA : FAL_MODELS.KONTEXT_PRO;

  const result = await fal.subscribe(model, {
    input: {
      image_url: imageUrl,
      prompt,
      ...(seed !== undefined ? { seed } : {}),
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[]; seed?: number };

  return {
    imageUrl: data.images[0].url,
    seed: data.seed ?? seed ?? -1,
    generationTimeMs: Date.now() - startedAt,
  };
}

// Dipakai untuk foto "utama" — ganti background + aksesoris.
export async function runStage2Edit(input: Stage2Input): Promise<Stage2Result> {
  return callKontext(input.baseImageUrl, buildBackgroundPrompt(input), input.engine, input.seed);
}

export interface DetailCropInput {
  baseImageUrl: string; // foto UTAMA yang sudah selesai (bukan hasil VTO mentah)
  focusArea: string; // deskripsi bagian yang di-zoom, mis. "collar and neckline embroidery"
  engine?: "kontext" | "nano-banana";
  seed?: number;
}

// Dipakai untuk foto "detail" & "seri" — menurunkan dari foto utama yang
// sudah jadi, bukan generate baru dari nol. Ini yang menjaga wajah & warna
// produk tetap sama persis di semua foto dalam satu set (§ catatan di atas).
export async function runDetailCrop(input: DetailCropInput): Promise<Stage2Result> {
  const prompt = [
    `Create a tight close-up crop of this exact photo, zoomed in on the ${input.focusArea}.`,
    "This must look like a zoomed-in detail shot from the exact same photoshoot — " +
      "same person, same face, same garment color and pattern, same background and lighting exactly as shown.",
    IDENTITY_AND_COLOR_LOCK,
    "Do not generate a new scene, new pose, or new person — only reframe/zoom into the specified area.",
  ].join(" ");

  return callKontext(input.baseImageUrl, prompt, input.engine, input.seed);
}

export interface ColorVariantInput {
  baseImageUrl: string; // foto UTAMA yang sudah selesai (bukan hasil VTO mentah)
  targetWarna: string; // warna varian target, mis. "MERAH"
  originalWarna?: string; // warna asli produk di foto utama, utk konteks prompt
  engine?: "kontext" | "nano-banana";
  seed?: number;
}

// Dipakai untuk foto "seri" (varian warna) — recolor garment dari foto
// utama yang sudah jadi, TANPA foto referensi warna asli (produk belum
// difoto ulang per warna) — jadi ini best-effort: AI menebak tampilan kain
// di warna baru berdasarkan deskripsi nama warna saja. Cukup akurat untuk
// preview katalog, tapi tidak dijamin 100% match warna fisik asli produk.
export async function runColorVariant(input: ColorVariantInput): Promise<Stage2Result> {
  const prompt = [
    `Change ONLY the color of the garment the model is wearing to ${input.targetWarna}` +
      (input.originalWarna ? ` (it is currently ${input.originalWarna})` : "") +
      ".",
    "Keep the exact same fabric pattern, print, embroidery, texture, stitching, trims, " +
      "and construction — only the base color/hue must change, the design itself must " +
      "stay completely identical, just rendered in the new color.",
    IDENTITY_LOCK_ONLY,
    "Do not generate a new scene, new pose, or new person — only recolor the garment.",
  ].join(" ");

  return callKontext(input.baseImageUrl, prompt, input.engine, input.seed);
}
