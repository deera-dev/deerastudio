// Generator "Lineup Warna" versi AI (Agustus 2026, REVISI BESAR) — admin
// awalnya minta "tanpa merubah detail sedikit pun" (makanya versi PERTAMA
// fitur ini murni compositing next/og dari foto asli, TANPA AI sama
// sekali). Setelah dikirimi 3 contoh foto referensi ("bikin kaya photoshot
// video seri warna, tapi versi yang lebih bagusnya" — garment digantung
// rapi di hanger rail ATAU berdiri fanned/overlapping, styling studio
// premium, prop minimal spt tanaman/kursi kecil, backdrop hangat elegan),
// jelas versi compositing-mentah TIDAK bisa mencapai look itu — foto asli
// yang diupload admin adalah flat-lay biasa, bukan foto di hanger rail
// bergaya editorial. Jadi fitur ini PIVOT ke AI generation (Nano Banana Pro,
// sama seperti mesin generate utama di nano-banana-generate.ts), TAPI tetap
// menjaga niat "jangan ubah detail produk" via prompt yang SANGAT eksplisit:
// tiap garment WAJIB reproduksi persis dari foto referensinya sendiri
// (framing "blueprint/absolute source of truth" yang SAMA dipakai di
// nano-banana-generate.ts) — yang boleh berubah HANYA presentasi/susunan/
// pencahayaan scene-nya, bukan desain garment itu sendiri.
//
// BEDA dari nano-banana-generate.ts: di sana yang di-generate adalah
// "garment dipakai MODEL". Di sini yang di-generate adalah "beberapa
// garment (warna berbeda) ditampilkan BERSAMA dalam 1 foto produk", TANPA
// model sama sekali — murni product photography multi-warna, meniru gaya
// "colorway lineup" umum di e-commerce fashion premium.
//
// Teks/label warna SENGAJA TIDAK diminta dirender oleh AI di dalam gambar
// (model image-gen tidak reliable merender teks bersih) — ditempel
// terpisah SETELAH generate lewat next/og, lihat lib/image-template/
// color-lineup.tsx & app/api/generation-sets/[id]/color-lineup/route.ts.
import { fal, FAL_MODELS } from "../fal/client";

export interface ColorLineupReference {
  url: string; // foto ASLI yang diupload admin (flat-lay/full-body) utk warna ini — sumber kebenaran garment
  label: string; // nama warna, mis. "MERAH", dipakai di PRODUCT REFERENCE MAP prompt (bukan dirender literal di gambar)
}

// REVISI (Agustus 2026 — admin minta 2 gaya tambahan: 1) "baju terlipat
// mirip seperti image-3, tapi ga sama persis juga kaya gitu ya" (referensi:
// tumpukan sweater terlipat rapi berjejer, gaya etalase butik/toko retail —
// diadaptasi jadi versi lebih premium/editorial, BUKAN reproduksi persis
// foto itu), dan 2) "1nya lagi terserah ide kamu aja apalagi yang bagus" —
// dipilih "flatlay" (top-down flat-lay, gaya e-commerce premium yang umum
// & mudah dicapai AI, beda secara visual dari 3 gaya lain: hanger=vertikal
// digantung, fanned=berdiri tumpang tindih, folded=ditumpuk terlipat).
export type ColorLineupStyle = "hanger" | "fanned" | "folded" | "flatlay";

export interface ColorLineupGenerateInput {
  references: ColorLineupReference[]; // 2-7 foto, urutan = urutan tampil di scene (kiri ke kanan)
  productKode: string;
  style?: ColorLineupStyle; // default "hanger"
  styleNote?: string; // catatan mood/gaya tambahan opsional dari admin (Inggris lebih akurat)
  seed?: number;
}

export interface ColorLineupGenerateResult {
  imageUrl: string;
  seed: number;
  generationTimeMs: number;
}

function buildPrompt(input: ColorLineupGenerateInput): string {
  const style = input.style ?? "hanger";
  const count = input.references.length;

  const referenceMap = input.references
    .map((r, i) => `COLOR REFERENCE ${i + 1} = "${r.label}"`)
    .join("\n");

  const STYLE_CLAUSES: Record<ColorLineupStyle, string> = {
    hanger: `Arrange all ${count} garments hanging neatly side by side on a single horizontal rail, evenly spaced, each on a matching wooden or matte black hanger. Every garment must be fully visible from a consistent front-facing angle (collar/neckline down to hem), hanging naturally with realistic fabric weight and drape — no garment overlapping or obscuring another.`,
    fanned: `Arrange all ${count} garments standing upright in a gentle overlapping/cascading fan formation from left to right (each slightly behind and offset from the previous one, like a fanned deck), so every garment's front is still fully visible — collar, buttons, sleeve, and hem — even where they overlap. Realistic soft fabric folds and natural standing silhouette for each, as if each were worn by an invisible mannequin.`,
    // "Terlipat Rapi" — diadaptasi dari referensi tumpukan sweater terlipat
    // gaya etalase butik yang dikirim admin, TAPI dinaikkan jadi lebih
    // premium/editorial (bukan reproduksi persis): tiap garment dilipat
    // jadi 1 tumpukan rapi, disusun berjejer, difoto dari sudut yang
    // memperlihatkan permukaan atas + sisi lipatan supaya motif/tekstur
    // tetap terlihat jelas per warna.
    folded: `Fold each of the ${count} garments neatly into a compact rectangular stack (as if freshly folded for a boutique display) and arrange all ${count} stacks in a single neat row, evenly spaced with a small gap between each. Photograph from a gentle top-down/three-quarter angle so the top surface AND the folded front edge of every stack are both clearly visible — this must legibly show each garment's fabric print, texture, and color across its folded surface, not just a flat colored rectangle. Slight natural variation in fold height between stacks is fine for an effortless, hand-styled look, but keep every stack tidy and rectangular, not messy or crumpled.`,
    // "Flat Lay Atas" — top-down flat-lay premium, gaya e-commerce umum,
    // sengaja dipilih beda arah dari 3 gaya lain (semua garment terbentang
    // rata, bukan digantung/berdiri/dilipat).
    flatlay: `Lay each of the ${count} garments fully flat and fully extended (unfolded, not hanging, not standing) on a clean flat surface, arranged in a single neat horizontal row with even spacing between each garment and no overlap. Shoot from directly overhead (true top-down flat-lay angle) so each garment's complete silhouette — collar, both sleeves, and full hem — is visible in one unbroken outline, with soft natural fabric creases only, no styling folds.`,
  };
  const styleClause = STYLE_CLAUSES[style];

  return [
    "You are an expert in premium fashion e-commerce and catalog product photography, specifically 'colorway lineup' shots that present the SAME garment design in multiple color options within a single elegant image, with no model present.",
    "",
    `You are given ${count} REFERENCE images. Each one is a photograph of the ACTUAL PHYSICAL GARMENT in one specific colorway — not inspiration, not a similar product, but the exact real product. Treat each reference photo as a blueprint and absolute source of truth for that specific garment's construction, print, and color.`,
    "",
    `PRODUCT REFERENCE MAP (in the exact order the reference images are provided):\n${referenceMap}`,
    "",
    `TASK: create ONE new photorealistic, premium product photograph that displays ALL ${count} colorways of this garment TOGETHER in one elegant, editorial-quality scene, so a customer can compare every color option at a glance. This is a STYLING/COMPOSITING task, not a redesign task — you already have the exact real garments, your job is to present them beautifully together.`,
    "",
    "CORE RULE (critical, highest priority): every garment's design — silhouette, cut, construction, print/pattern, embroidery, buttons, pleats, trims, proportions, and length — must be reproduced EXACTLY as shown in its own reference photo. Only the ARRANGEMENT, presentation, lighting, and background of the scene may change. Do not redesign, simplify, modernize, or beautify any garment. Do not swap or blend details between colorways. Since this is the same product design across all colors, the construction/silhouette must look IDENTICAL across every garment in the lineup — only the fabric color/print differs, exactly matching each garment's own reference photo. THE PRODUCT ITSELF MUST NOT CHANGE IN ANY WAY — you are photographing the same real garments in a nicer setting, not creating new ones.",
    "",
    `STYLING & ARRANGEMENT: ${styleClause}`,
    "",
    "BACKGROUND & MOOD: a soft, warm, neutral premium studio backdrop — a gentle gradient of cream, warm grey, or softly lit plain wall (avoid a harsh flat pure-white look). You may include ONE small tasteful styling prop (e.g. a small potted plant, a folded textile, a simple wooden stool or side table) placed unobtrusively to one side — it must never overlap or obscure any garment. Soft, even, flattering directional studio lighting with a gentle natural shadow beneath each garment. The background/lighting/props must never be warmer, cooler, or more saturated in a way that shifts how any garment's color reads — the studio setting supports the garments, it must never tint them. The overall mood should feel more refined, elegant, and premium than a typical flat product photo — think high-end fashion e-commerce hero imagery.",
    "",
    "COLOR ACCURACY (critical, equal priority to CORE RULE above): each garment's fabric color/print in the output MUST match its own reference photo EXACTLY — same hue, same saturation, same depth/darkness, same pattern colorway. This is the single most important quality check for this image: a customer will be choosing between colors based on this photo, so if a color is even slightly off (too light, too dark, too warm, too cool, desaturated, or shifted toward a neighboring color) the photo has failed its purpose. Do not let studio lighting warm/cool-tint any garment away from its true reference color. Do not average, blend, or make colors look more similar to each other than they actually are — if two colorways are genuinely close (e.g. two shades of brown), preserve that same subtle distinction faithfully rather than pushing them apart OR collapsing them together. No color cast or tint bleeding from the background onto any garment, no garment appearing washed out, over-saturated, or shifted in hue relative to its reference.",
    "",
    "NO TEXT: do not render any text, labels, price tags, logos, or watermarks anywhere in the image — text will be added separately afterward.",
    "",
    "NO HALLUCINATION: do not invent garment details not visible in the reference photos. If a reference photo shows a dense, continuous all-over print or texture, reproduce that same density and continuity across the entire visible garment — do not thin it out or simplify it into a sparser pattern.",
    "",
    input.styleNote?.trim() ? `ADDITIONAL MOOD/STYLE NOTE from the art director: ${input.styleNote.trim()}.` : "",
    "",
    "Before finalizing, verify internally, in this order: (1) Is every garment's construction, silhouette, and every design detail IDENTICAL to its own reference photo — nothing added, removed, or altered? (2) Does every garment's color/print match its own reference photo EXACTLY, with no hue/saturation/brightness shift from lighting or background? (3) Does the scene look premium, elegant, and editorial rather than a plain flat product shot? Checks (1) and (2) are non-negotiable — the product must not change, and the colors must be exactly right.",
    "",
    "Produce ONE final photorealistic image.",
  ]
    .filter(Boolean)
    .join("\n");
}

// Urutan tampil warna kiri-ke-kanan (Agustus 2026 — admin: "saya ingin
// bisa mengatur posisi warnanya, apakah bisa?"). Dipakai di 2 tempat yang
// perlu membangun `references[]` (app/api/generation-sets/[id]/
// color-lineup/route.ts & app/api/generations/[id]/regenerate/route.ts
// cabang kolase_warna) supaya logic-nya konsisten & tidak duplikat.
// Self-healing: key yang tidak ada di `order` (warna baru ditambah setelah
// urutan diset, atau order belum pernah diset) di-append di AKHIR sesuai
// urutan asli argumen (main dulu, lalu lineup_color_refs apa adanya).
export function orderColorReferences(
  mainRef: ColorLineupReference,
  extraRefs: { warna: string; ref: ColorLineupReference }[],
  order: string[] | null | undefined
): ColorLineupReference[] {
  const MAIN_KEY = "__main__";
  const known = new Map<string, ColorLineupReference>([[MAIN_KEY, mainRef]]);
  for (const e of extraRefs) known.set(e.warna, e.ref);

  const orderedKeys = (order ?? []).filter((k) => known.has(k));
  const missingKeys = [...known.keys()].filter((k) => !orderedKeys.includes(k));
  return [...orderedKeys, ...missingKeys].map((k) => known.get(k)!);
}

export async function runColorLineupGenerate(
  input: ColorLineupGenerateInput
): Promise<ColorLineupGenerateResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(input),
      image_urls: input.references.map((r) => r.url),
      aspect_ratio: "1:1",
      resolution: "2K",
      output_format: "png",
      seed,
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[] };

  return {
    imageUrl: data.images[0].url,
    seed,
    generationTimeMs: Date.now() - startedAt,
  };
}
