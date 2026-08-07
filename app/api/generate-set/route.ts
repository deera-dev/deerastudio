// CATATAN PRODUKSI: handler ini generate beberapa gambar secara SINKRON dalam
// satu request — total bisa beberapa menit. Vercel default timeout function
// jauh lebih pendek dari itu untuk plan gratis/hobby. Untuk MVP awal ini oke
// dipakai apa adanya kalau dev di-host di server yang timeout-nya
// dilonggarkan, atau untuk testing lokal. Kalau nanti deploy ke Vercel,
// pertimbangkan pindah ke queue worker (sudah ada di roadmap V2, PRD §19).
//
// REVISI #1 (setelah tes nyata pertama — wajah & warna beda-beda antar foto):
// VTO cuma dipanggil sekali untuk foto "utama", foto "detail" & "seri"
// diturunkan dari foto utama lewat Kontext crop/zoom (runDetailCrop).
//
// REVISI #2 (setelah feedback kedua — foto tambahan ternyata ada 2 jenis
// beda konsep di katalog Deera asli):
//   - "detail" = crop close-up jahitan/kancing/kerah, DITURUNKAN dari utama.
//   - "angle" = foto BADAN PENUH dari pose lain — WAJIB generate independen
//     dengan pose_id berbeda. Background & seed yang SAMA dipakai ulang
//     untuk setiap foto angle supaya wajah & warna tetap senada.
//
// REVISI #3 / "Opsi B" (Agustus 2026 — setelah keluhan fabric masih tidak
// akurat dengan FASHN VTO): foto "utama" & "angle" sekarang generate lewat
// SATU pemanggilan Nano Banana Pro (lib/prompts/nano-banana-generate.ts),
// bukan lagi VTO+Kontext 2-tahap. Pemilik produk membuktikan sendiri lewat
// tes manual di Gemini bahwa "banyak foto referensi ASLI + prompt detail"
// jauh lebih akurat menjaga motif/tekstur produk. Perubahan konkret:
//   - SEMUA foto produk yang diupload (depan + detail-detail opsional)
//     dikirim APA ADANYA sebagai entri terpisah — TIDAK dikomposit lagi.
//   - Identitas model diperkuat dengan 1-2 foto pose LAIN dari model yang
//     sama (identityReferenceUrls), meniru pola 4-foto-referensi yang
//     terbukti berhasil di tes manual.
//   - Background & aksesoris dijelaskan lewat teks di prompt yang sama
//     (bukan tahap Kontext terpisah) — identitas, produk, & background
//     selesai dalam 1 pass, mengurangi jumlah generasi diffusion berturut
//     yang selama ini jadi sumber drift wajah.
//
// REVISI #4 (Agustus 2026, sesudah "Opsi B", iterasi pertama — SUDAH
// DIKOREKSI lagi di REVISI #5): "seri" awalnya dikoreksi dari "foto angle
// lain" (keliru) menjadi varian WARNA lain dari produk yang sama, tapi
// sempat di-generate lewat RECOLOR foto utama pakai Kontext (runColorVariant)
// — tanpa foto asli warna itu.
//
// REVISI #5 (Agustus 2026, iterasi kedua — SUDAH DISEDERHANAKAN lagi di
// REVISI #6, lihat di bawah): pemilik produk menolak pendekatan recolor di
// REVISI #4 — akurasi warna/motif hasil tebakan AI tidak bisa diandalkan
// utk katalog produksi. Struktur diubah: admin upload FOTO ASLI (flat-lay)
// LENGKAP (7 slot, sama seperti productImages) utk SETIAP warna varian.
//
// REVISI #6 (Agustus 2026, final): pemilik produk merasa upload 7 foto per
// warna terlalu berat secara operasional — instruksi eksplisit: "[foto
// utama] itu hanya untuk main colornya saja, kemudian ada card baru buat
// masukin foto full body warna-warna lain, jadi cuma upload 1 full body per
// warna, sisanya ambil reference dari gambar 1 / main colornya". Alasannya
// masuk akal: potongan/bordir/motif konstruksi garmen IDENTIK di semua
// warna, yang benar-benar beda cuma warna kainnya — jadi tidak perlu foto
// detail berulang per warna. Struktur baru: seriEntries sekarang cuma
// { warna, image } (SATU foto full-body warna itu, bukan lagi 7 slot).
// Saat generate, garmentImageUrls utk tiap warna = SEMUA foto warna utama
// (primaryGarmentUrls, utk referensi bentuk/tekstur/bordir) + SATU foto
// warna target itu sendiri (utk referensi warna) — dikirim sekaligus ke
// Nano Banana Pro dengan flag isColorVariant=true supaya prompt tahu cara
// membedakan mana referensi warna vs referensi konstruksi (lihat klausa 2b
// di lib/prompts/nano-banana-generate.ts). Baris ai_generations utk role
// "seri" menyimpan variant_warna (nama warna) + variant_product_images
// ({ image: <url foto warna itu> }, dipakai ulang saat regenerate — lihat
// app/api/generations/[id]/regenerate/route.ts).
//
// POST /api/generate-set — PRD §15 & §7.6.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runNanoBananaGenerate } from "@/lib/prompts/nano-banana-generate";
import { runDetailCrop } from "@/lib/prompts/stage2";
import { composeBackground, type BackgroundMode } from "@/lib/prompts/background-composer";
import type { AccessoryPresetRow, BackgroundPresetRow } from "@/types/database";

const productImagesSchema = z.object({
  front: z.string().url(),
  back: z.string().url().optional(),
  detailNeck: z.string().url().optional(),
  detailSleeve: z.string().url().optional(),
  detailChest: z.string().url().optional(),
  detailHem: z.string().url().optional(),
  fullBody: z.string().url().optional(),
});

const requestSchema = z.object({
  modelId: z.string().uuid(),
  poseId: z.string().uuid(), // pose untuk foto utama
  anglePoseIds: z.array(z.string().uuid()).max(3).default([]), // pose lain utk foto angle (badan penuh, pose beda)
  productKode: z.string(),
  backgroundMode: z.enum(["auto", "preset", "ai_improvised"]).default("auto"),
  backgroundPresetId: z.string().uuid().optional(),
  accessoryPresetIds: z.array(z.string().uuid()).default([]),
  productImages: productImagesSchema, // foto warna UTAMA/default — 7 slot lengkap
  productWarna: z.string().optional(), // warna utama yg dipakai di foto utama/angle
  // REVISI #6 (final, hemat-foto): "seri" = varian WARNA lain dari produk
  // yang sama. Cukup SATU foto full-body per warna — foto detail/konstruksi
  // lainnya otomatis dipakai ulang dari productImages (warna utama), karena
  // bentuk/bordir/motif identik lintas warna, cuma warna kain yang beda.
  seriEntries: z
    .array(z.object({ warna: z.string(), image: z.string().url() }))
    .max(6)
    .default([]),
  detailCount: z.number().int().min(0).max(3).default(1), // jumlah foto close-up detail (0-3)
});

// Deskripsi area zoom untuk foto "detail" — diturunkan dari foto utama
// lewat Kontext (crop/zoom murni, lihat lib/prompts/stage2.ts).
const DETAIL_FOCUS_AREAS = [
  "collar and neckline embroidery",
  "sleeve cuff and sleeve embroidery detail",
  "fabric texture and embroidery pattern on the torso",
];

// Berapa banyak foto pose LAIN dari model yang sama dipakai sbg penguat
// identitas di tiap pemanggilan Nano Banana Pro (di luar foto pose target).
const IDENTITY_REFERENCE_COUNT = 2;

// Estimasi Rp per panggilan (kurs ~Rp17.900/USD, Agustus 2026):
// Nano Banana Pro $0.15/gambar (resolusi 1K) ~ Rp2.700, Kontext Pro flat
// $0.04 ~ Rp640.
const COST_FULL_PASS = 2700; // 1x Nano Banana Pro (utama, tiap foto angle, DAN tiap foto seri)
const COST_DERIVED = 640; // 1x Kontext saja (detail, diturunkan dari utama)

// Kumpulkan semua URL foto produk warna UTAMA (depan + 6 slot detail
// opsional) jadi satu array — dipakai utk foto utama/angle, DAN sbg
// referensi bentuk/tekstur/bordir (bukan warna) di tiap foto seri.
function collectGarmentUrls(images: z.infer<typeof productImagesSchema>) {
  return [
    images.front,
    images.detailChest,
    images.detailNeck,
    images.detailSleeve,
    images.detailHem,
    images.back,
    images.fullBody,
  ].filter((url): url is string => Boolean(url));
}

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const input = body.data;
  const anglePoseIds = [...new Set(input.anglePoseIds)].filter((id) => id !== input.poseId);

  const supabase = await createClient();

  // 1. Ambil semua pose yang dipakai (utama + angle) — semua wajib milik model ini (§7.3)
  const allPoseIds = [input.poseId, ...anglePoseIds];
  const { data: posesRaw, error: posesError } = await supabase
    .from("ai_poses")
    .select("id, model_id, reference_image_url")
    .in("id", allPoseIds)
    .eq("model_id", input.modelId);
  const posesById = new Map((posesRaw ?? []).map((p) => [p.id, p]));
  if (posesError || !posesById.has(input.poseId)) {
    return NextResponse.json({ error: "Pose utama tidak ditemukan untuk model ini" }, { status: 404 });
  }
  const validAnglePoseIds = anglePoseIds.filter((id) => posesById.has(id));

  // 1b. Ambil beberapa foto pose LAIN dari model yang sama sbg penguat
  // identitas (lihat IDENTITY_REFERENCE_COUNT) — dipakai ulang di semua
  // pemanggilan Nano Banana Pro dalam set ini (termasuk tiap foto seri).
  const { data: identityPoolRaw } = await supabase
    .from("ai_poses")
    .select("id, reference_image_url")
    .eq("model_id", input.modelId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(IDENTITY_REFERENCE_COUNT + allPoseIds.length);
  const identityPool = (identityPoolRaw ?? []).map((p) => p.reference_image_url);

  // 2. Ambil background presets aktif + accessory presets terpilih untuk komposisi (§7.4)
  const { data: presetsRaw } = await supabase
    .from("ai_background_presets")
    .select("*")
    .eq("is_active", true);
  const presets = (presetsRaw ?? []) as BackgroundPresetRow[];

  const { data: accessoriesRaw } = input.accessoryPresetIds.length
    ? await supabase.from("ai_accessory_presets").select("*").in("id", input.accessoryPresetIds)
    : { data: [] as AccessoryPresetRow[] };
  const accessories = (accessoriesRaw ?? []) as AccessoryPresetRow[];

  // 3. Tentukan background SEKALI untuk seluruh set — dipakai ulang di semua
  // foto (utama + angle + seri) supaya lokasi/scene konsisten dalam 1 produk.
  const background = composeBackground({
    mode: input.backgroundMode as BackgroundMode,
    productWarna: input.productWarna,
    presets,
    forcedPresetId: input.backgroundPresetId,
  });
  if (background.source === "preset" && background.presetId) {
    await supabase
      .from("ai_background_presets")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", background.presetId);
  }

  // 4. Buat generation_set (status queued -> processing)
  const { data: set, error: setError } = await supabase
    .from("ai_generation_sets")
    .insert({
      product_kode: input.productKode,
      model_id: input.modelId,
      pose_id: input.poseId,
      background_mode: input.backgroundMode,
      background_preset_id: input.backgroundPresetId ?? null,
      accessory_preset_ids: input.accessoryPresetIds,
      product_images: input.productImages,
      product_warna: input.productWarna ?? null,
      status: "processing",
    })
    .select()
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Gagal membuat generation set" }, { status: 500 });
  }

  // Semua foto produk warna UTAMA yang diupload — dikirim APA ADANYA (tidak
  // dikomposit) ke Nano Banana Pro, lihat catatan "Opsi B" di atas. Dipakai
  // ulang sbg referensi bentuk/tekstur/bordir di tiap foto seri (REVISI #6).
  const primaryGarmentUrls = collectGarmentUrls(input.productImages);

  let totalCost = 0;
  let anyFailed = false;
  let utamaFinalUrl: string | null = null;
  let sharedSeed: number | undefined;

  // Jalankan Nano Banana Pro penuh untuk 1 pose + 1 set foto produk — dipakai
  // utama, tiap angle, DAN tiap warna seri (beda-beda garmentUrls/variant).
  async function runFullPass(
    role: "utama" | "angle" | "seri",
    poseId: string,
    poseImageUrl: string,
    garmentUrls: string[],
    variantWarna?: string,
    variantProductImages?: Record<string, string>
  ) {
    const { data: gen } = await supabase
      .from("ai_generations")
      .insert({
        generation_set_id: set.id,
        image_role: role,
        pose_id: role === "seri" ? null : poseId,
        variant_warna: variantWarna ?? null,
        variant_product_images: variantProductImages ?? null,
        status: "processing",
      })
      .select()
      .single();

    try {
      const identityReferenceUrls = identityPool
        .filter((url) => url !== poseImageUrl)
        .slice(0, IDENTITY_REFERENCE_COUNT);

      const result = await runNanoBananaGenerate({
        poseImageUrl,
        identityReferenceUrls,
        garmentImageUrls: garmentUrls,
        backgroundDescription: background.description,
        productWarna: variantWarna ?? input.productWarna,
        accessoryPromptFragments: accessories.map((a) => a.prompt_fragment),
        seed: sharedSeed,
        isColorVariant: role === "seri",
      });
      if (sharedSeed === undefined) sharedSeed = result.seed;

      totalCost += COST_FULL_PASS;

      await supabase
        .from("ai_generations")
        .update({
          vto_image_url: null,
          output_image_url: result.imageUrl,
          has_stage2: true,
          status: "completed",
          generation_time_ms: result.generationTimeMs,
          cost: COST_FULL_PASS,
        })
        .eq("id", gen!.id);

      return result.imageUrl;
    } catch (err) {
      anyFailed = true;
      await supabase
        .from("ai_generations")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", gen!.id);
      return null;
    }
  }

  // --- Foto UTAMA ---
  utamaFinalUrl = await runFullPass(
    "utama",
    input.poseId,
    posesById.get(input.poseId)!.reference_image_url,
    primaryGarmentUrls
  );

  // --- Foto ANGLE (badan penuh, pose lain) — panggil Nano Banana Pro independen per pose ---
  for (const anglePoseId of validAnglePoseIds) {
    await runFullPass(
      "angle",
      anglePoseId,
      posesById.get(anglePoseId)!.reference_image_url,
      primaryGarmentUrls
    );
  }

  // --- Foto SERI (varian warna lain, 0-6x): full pass independen, pose SAMA
  // dengan utama (supaya model/pose konsisten). REVISI #6: garmentUrls =
  // SEMUA foto warna utama (referensi bentuk/tekstur/bordir) + SATU foto
  // full-body warna target itu sendiri (referensi warna) — lihat klausa 2b
  // di nano-banana-generate.ts utk cara AI membedakan keduanya. ---
  const utamaPoseUrl = posesById.get(input.poseId)!.reference_image_url;
  for (const entry of input.seriEntries) {
    await runFullPass(
      "seri",
      input.poseId,
      utamaPoseUrl,
      [...primaryGarmentUrls, entry.image],
      entry.warna,
      { image: entry.image }
    );
  }

  // --- Foto DETAIL (close-up, 0-3x): diturunkan dari utama ---
  if (utamaFinalUrl) {
    for (const focusArea of DETAIL_FOCUS_AREAS.slice(0, input.detailCount)) {
      const { data: gen } = await supabase
        .from("ai_generations")
        .insert({ generation_set_id: set.id, image_role: "detail", status: "processing" })
        .select()
        .single();

      try {
        const crop = await runDetailCrop({ baseImageUrl: utamaFinalUrl, focusArea, seed: sharedSeed });
        totalCost += COST_DERIVED;

        await supabase
          .from("ai_generations")
          .update({
            output_image_url: crop.imageUrl,
            has_stage2: true,
            status: "completed",
            generation_time_ms: crop.generationTimeMs,
            cost: COST_DERIVED,
          })
          .eq("id", gen!.id);
      } catch (err) {
        anyFailed = true;
        await supabase
          .from("ai_generations")
          .update({ status: "failed", error_message: (err as Error).message })
          .eq("id", gen!.id);
      }
    }
  } else {
    anyFailed = true;
  }

  await supabase
    .from("ai_generation_sets")
    .update({ status: anyFailed ? "partial" : "completed", total_cost: totalCost })
    .eq("id", set.id);

  return NextResponse.json({
    generationSetId: set.id,
    status: anyFailed ? "partial" : "completed",
  });
}
