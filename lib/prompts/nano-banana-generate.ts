// Mesin generate utama — "Opsi B" (Agustus 2026): satu pemanggilan Nano
// Banana Pro (fal-ai/nano-banana-pro/edit) menggantikan pipeline lama
// FASHN VTO + Kontext (2 tahap).
//
// LATAR BELAKANG: pemilik produk membuktikan sendiri lewat tes manual di
// Gemini bahwa pendekatan "banyak foto referensi ASLI model + banyak foto
// produk ASLI + 1 prompt sangat detail" jauh lebih akurat menjaga motif/
// tekstur produk dibanding model VTO sempit (FASHN/FLUX) yang cuma nerima
// 2 foto tanpa instruksi teks. Nano Banana Pro (Gemini 3 Pro Image) dites
// terbukti cocok karena API-nya (image_urls: string[]) menerima BANYAK
// foto sekaligus + 1 prompt bebas — persis pola yang sudah berhasil itu.
//
// PERBEDAAN dari pipeline lama:
// - TIDAK ADA compositing foto produk (lib/images/composite-garment.ts) —
//   semua foto produk yang diupload dikirim APA ADANYA sebagai entri
//   terpisah di image_urls, Nano Banana Pro cukup pintar membedakan &
//   menggabungkan info dari tiap foto lewat instruksi di prompt.
// - Identitas model diperkuat dengan 1-2 foto pose LAIN dari model yang
//   sama (bukan cuma foto pose target), meniru pola 4-foto-referensi yang
//   terbukti berhasil di tes manual.
// - Background/aksesoris dijelaskan lewat teks di prompt (bukan tahap
//   Kontext terpisah) — jadi identitas, produk, DAN background sekarang
//   selesai dalam SATU pass, mengurangi jumlah generasi diffusion
//   berturut-turut yang selama ini jadi sumber drift wajah.
// - Foto "detail"/"seri" (crop/zoom dari foto utama) TETAP pakai Kontext
//   (lib/prompts/stage2.ts runDetailCrop) — itu operasi reframe murni,
//   bukan re-render produk dari nol, jadi tidak perlu ganti & tetap murah.
import { fal, FAL_MODELS } from "../fal/client";

export interface NanoBananaGenerateInput {
  poseImageUrl: string; // foto model pada pose TARGET (ai_poses.reference_image_url)
  identityReferenceUrls?: string[]; // foto lain model yg sama — penguat identitas, opsional tp direkomendasikan
  garmentImageUrls: string[]; // SEMUA foto produk asli yang diupload (depan wajib, sisanya opsional) — tidak dikomposit
  backgroundDescription: string; // dari composeBackground()
  productWarna?: string;
  accessoryPromptFragments?: string[];
  seed?: number;
  // REVISI Agustus 2026 (seri hemat-foto): true KHUSUS utk role "seri" —
  // garmentImageUrls di call ini adalah CAMPURAN 2 warna (semua foto warna
  // utama/default + 1 foto warna target warna itu sendiri), lihat catatan
  // di app/api/generate-set/route.ts. Prompt butuh instruksi tambahan (lihat
  // klausa 2b di buildPrompt) supaya AI tidak salah warna/tidak nge-blend
  // 2 warna jadi satu.
  isColorVariant?: boolean;
  // REVISI #8 (Agustus 2026, "4 foto tetap" — angle disederhanakan jadi
  // BELAKANG tanpa pilih pose per-generate): true KHUSUS utk role "angle".
  // REVISI #9 (segera setelah #8 gagal di tes nyata — hasil "angle" malah
  // keluar foto DEPAN lagi): coba #8 pakai poseImageUrl yang SAMA dgn utama
  // + instruksi teks "putar ke belakang" — TERBUKTI tidak reliable, model AI
  // lebih niru struktur visual foto referensi drpd ikutin instruksi teks.
  // Sekarang poseImageUrl utk role "angle" adalah foto referensi ASLI yang
  // sudah menunjukkan belakang model (ai_poses.is_back_view, ditandai admin
  // SEKALI per model di halaman Poses — lihat app/api/generate-set/route.ts
  // REVISI #9), dan flag ini cuma REINFORCEMENT teks tambahan di buildPrompt
  // (menegaskan "wajah tidak boleh terlihat, ini foto belakang"), bukan lagi
  // satu-satunya sinyal yang menentukan arah foto.
  isBackView?: boolean;
}

export interface NanoBananaGenerateResult {
  imageUrl: string;
  seed: number;
  description: string;
  generationTimeMs: number;
}

function buildPrompt(input: NanoBananaGenerateInput): string {
  const accessoryClause = input.accessoryPromptFragments?.length
    ? input.accessoryPromptFragments.join(", ")
    : "";

  return [
    "You are an expert in professional fashion photography, garment visualization, and high-fidelity image editing.",
    "",
    "You are given: (1) one or more MODEL REFERENCE images of the same real female model — these establish her exact face, identity, body proportions, and the brand's photography style; (2) one or more PRODUCT REFERENCE images of a real garment — these are the ABSOLUTE SOURCE OF TRUTH for the new clothing.",
    "",
    "TASK: create ONE new photorealistic fashion catalog photograph of the SAME MODEL from the MODEL REFERENCE images, now wearing the EXACT garment shown in the PRODUCT REFERENCE images, in a new pose and setting described below. The result must look like a real professional photograph from the same brand's catalog, not an AI-generated image.",
    "",
    "CORE RULE: only the clothing, pose, and background should change. The model's identity must stay the same person. The garment must be reproduced from the PRODUCT REFERENCE images with maximum possible accuracy — do not redesign, reinterpret, simplify, or improve it, and do not blend any clothing details from the MODEL REFERENCE images into the new garment (those old clothes are NOT the product; they exist only to show who the model is).",
    "",
    "1. MODEL IDENTITY (critical): use the exact same woman shown in the MODEL REFERENCE images. Preserve her face shape, eyes, eyebrows, nose, lips, jawline, skin tone, skin texture, body proportions, apparent height, physique, apparent age, hands, and fingers. Do not generate a different woman. Do not beautify or restructure her face. Minor natural photographic variation is fine, but identity consistency is mandatory.",
    "",
    "2. GARMENT FIDELITY (critical — this is what the PRODUCT REFERENCE images are for): reproduce the exact garment color, color combinations, fabric appearance, material, texture, lace, embroidery, motifs, printed or woven patterns, borders, trims, stitching, seams, panels, pleats, folds, sleeves, cuffs, collar, neckline, buttons, decorative elements, construction, silhouette, length, and proportions exactly as shown in the PRODUCT REFERENCE images. Do not simplify small details, do not replace detailed patterns with generic ones, do not hallucinate embroidery that isn't there, do not remove difficult details. If a pattern is irregular or asymmetrical, keep it irregular — do not make it repetitive or symmetrical.",
    "",
    input.isColorVariant && input.productWarna
      ? `2b. MIXED COLOR REFERENCE HANDLING (critical): the PRODUCT REFERENCE images in this request show the SAME garment design in TWO different colorways — most of them are the brand's default/primary color, and exactly ONE photo shows the actual TARGET color for this output: "${input.productWarna}". Identify which reference photo's fabric color matches the name "${input.productWarna}" and use ONLY that photo as the source of truth for the garment's color and fabric shade. Use ALL the OTHER reference photos — regardless of their color — only for garment shape, cut, silhouette, embroidery pattern, motif placement, stitching, and construction detail; those structural details are identical across colorways and must not change. Do not blend, average, or mix the colors from different reference photos together — the final garment color must exactly match the single "${input.productWarna}" reference photo, nothing else.`
      : "",
    "",
    input.isBackView
      ? "2c. BACK VIEW REFERENCE PRIORITY: if one of the PRODUCT REFERENCE images shows the back of the garment, treat it as the primary source of truth for this back-view shot — reproduce its back panel, closure, seams, and any back-facing embroidery/motif exactly. If no dedicated back-view reference photo is given, infer the back construction logically from the front/side reference photos (typical construction for this garment type), keeping the same fabric, color, and trims."
      : "",
    "",
    "3. GARMENT CONSTRUCTION: the clothing must behave like a real physical garment on her body — realistic fabric weight, natural draping, folds, wrinkles, and tension appropriate to the fabric shown in the PRODUCT REFERENCE images. Do not paint the garment onto her body. Do not make it tighter than the actual product's cut.",
    "",
    input.isBackView
      ? "4. POSE & FRAMING (BACK VIEW — critical): one of the MODEL REFERENCE images already shows this exact model with her BACK to the camera. Reproduce that same back-facing standing pose and camera framing in the new photograph — she must be facing AWAY from the camera the entire time, showing the back of the garment (back panel, back embroidery/motif if any, closure, hemline from behind, hijab drape from behind). Full body must be visible from head to toe. Her face must NOT be visible anywhere in this image — if any part of her face is visible, the pose is wrong. Do not crop the garment."
      : "4. POSE & FRAMING: a natural standing full-body fashion catalog pose. Full body must be visible from head to toe. Do not crop the garment. Do not zoom into just the face.",
    "",
    `5. BACKGROUND & SETTING: ${input.backgroundDescription}. The background must complement the garment and remain secondary to it — clean, elegant, premium studio/interior atmosphere suitable for an established Indonesian Muslim fashion brand. No distracting objects, no fantasy environment, no obviously AI-generated background.`,
    "",
    "6. STYLING: elegant modest hijab styling consistent with the MODEL REFERENCE images' brand language, natural makeup, minimal jewelry. Do not invent accessories that conflict with the product. If the PRODUCT REFERENCE images clearly include a matching hijab/inner/belt as part of the set, reproduce it accurately; otherwise do not add extra clothing items.",
    accessoryClause ? `Add these accessories if appropriate: ${accessoryClause}.` : "",
    input.productWarna
      ? `Hijab color and any visible footwear should coordinate with the garment's primary color: ${input.productWarna}.`
      : "",
    "",
    "7. LIGHTING & PHOTOGRAPHY STYLE: soft, controlled, even, natural-looking studio/catalog lighting — elegant, clean, premium, commercial, photorealistic. Avoid cinematic drama, excessive bokeh, HDR look, plastic skin, AI beauty-filter smoothing, or illustration/CGI appearance. The garment's color, texture, embroidery, and seams must all remain clearly visible and accurately lit — no highlights or shadows that hide garment details.",
    "",
    "8. HUMAN REALISM: realistic skin texture, anatomically correct hands and fingers (no extra or missing fingers, no deformed joints), natural limb proportions.",
    "",
    "9. NO HALLUCINATION: never invent product details not visible in the PRODUCT REFERENCE images. If a detail is hard to reproduce, preserve its visual structure rather than substituting a generic pattern.",
    "",
    "Before finalizing, verify internally: is this clearly the same model? Does the garment match the PRODUCT REFERENCE images in color, pattern, embroidery, silhouette, and proportions? Does it look like a real professional photograph? If any product detail conflicts with what the model is wearing in the MODEL REFERENCE images, always prioritize the PRODUCT REFERENCE images.",
    "",
    "Produce ONE final photorealistic image.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runNanoBananaGenerate(
  input: NanoBananaGenerateInput
): Promise<NanoBananaGenerateResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  const imageUrls = [
    input.poseImageUrl,
    ...(input.identityReferenceUrls ?? []),
    ...input.garmentImageUrls,
  ];

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(input),
      image_urls: imageUrls,
      aspect_ratio: "3:4",
      resolution: "1K",
      output_format: "jpeg",
      seed,
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[]; description?: string };

  return {
    imageUrl: data.images[0].url,
    seed,
    description: data.description ?? "",
    generationTimeMs: Date.now() - startedAt,
  };
}
