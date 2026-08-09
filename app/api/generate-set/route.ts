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
// REVISI #7 (Agustus 2026, "4 foto tetap" — admin kirim referensi lookbook
// nyata & minta "generate set foto selalu menghasilkan 4 foto seperti
// itu"): set foto sekarang SELALU menghasilkan PERSIS 4 baris ai_generations
// yang jadi deliverable akhir: "utama" (badan penuh, pose utama), "angle"
// (badan penuh, pose lain — SEKARANG WAJIB persis 1, bukan lagi 0-3
// opsional), "kolase_gabungan" (2 foto berdampingan + logo brand, disusun
// dari utama+angle), "kolase_detail" (foto utama full-bleed + 2 inset
// close-up berlabel DETAIL + logo brand, disusun dari utama + 2 crop
// close-up). Dua crop close-up yang jadi bahan kolase_detail (Kontext,
// sama seperti role "detail" versi lama) SEKARANG TIDAK disimpan sbg baris
// ai_generations terpisah lagi — cuma variabel sementara di handler ini,
// biayanya tetap ditambahkan ke totalCost tapi tidak tampil sbg item
// terpisah di UI, supaya jumlah foto yg admin lihat SELALU PERSIS 4 sesuai
// permintaan (bukan lagi "detailCount" yang bisa diatur admin 0-3). Kolase
// disusun via lib/image-template/set-collage.tsx (next/og ImageResponse,
// pola yang sama dgn Poster AI Content Studio) — BUKAN panggilan AI baru,
// jadi tidak ada biaya fal.ai tambahan utk kolase itu sendiri.
//
// REVISI #8 (Agustus 2026, segera setelah #7 — admin: "ini kita ambil angle
// belakang aja ya jadinya" / "jadi ga pilih pose lagi"): #7 sempat bikin
// "angle" WAJIB pilih pose kedua dari galeri ai_poses (mirip cara "utama"
// pilih pose) — ternyata itu bukan yang dimaksud admin. "Angle" sekarang
// disederhanakan jadi otomatis BELAKANG, tanpa perlu pilih pose sama
// sekali: pakai poseImageUrl yang SAMA dengan foto utama (input.poseId),
// tapi dipanggil dengan flag isBackView=true (lihat lib/prompts/
// nano-banana-generate.ts) supaya AI merender ulang scene yang SAMA dari
// sisi belakang model, bukan pose/sudut bebas. Field request `anglePoseId`
// DIHAPUS total — tidak ada lagi validasi "pose angle harus beda dari pose
// utama" karena memang sekarang selalu pose yang sama.
//
// POST /api/generate-set — PRD §15 & §7.6.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runNanoBananaGenerate } from "@/lib/prompts/nano-banana-generate";
import { runDetailCrop } from "@/lib/prompts/stage2";
import { composeBackground, type BackgroundMode } from "@/lib/prompts/background-composer";
import { renderKolaseGabunganPng, renderKolaseDetailPng } from "@/lib/image-template/set-collage";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import type { AccessoryPresetRow, BackgroundPresetRow } from "@/types/database";

const productImagesSchema = z.object({
  front: z.string().url(),
  back: z.string().url().optional(),
  detailNeck: z.string().url().optional(),
  detailSleeve: z.string().url().optional(),
  detailHand: z.string().url().optional(), // close-up pergelangan/manset tangan — BEDA dari detailSleeve
  detailChest: z.string().url().optional(),
  detailHem: z.string().url().optional(),
  fullBody: z.string().url().optional(),
});

const requestSchema = z.object({
  modelId: z.string().uuid(),
  poseId: z.string().uuid(), // pose untuk foto utama — DIPAKAI ULANG jg utk foto angle (REVISI #8)
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
});

// Deskripsi area zoom untuk foto "detail" — diturunkan dari foto utama
// lewat Kontext (crop/zoom murni, lihat lib/prompts/stage2.ts).
// REVISI #7: SELALU persis 2 dipakai (bahan kolase_detail) — kerah/leher
// utk inset #1, manset/lengan utk inset #2 (lihat renderKolaseDetailPng).
const DETAIL_FOCUS_AREAS = [
  "collar and neckline embroidery",
  "sleeve cuff and sleeve embroidery detail",
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
    images.detailHand,
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

  const supabase = await createClient();

  // 1. Ambil pose utama — WAJIB milik model ini (§7.3). REVISI #8: "angle"
  // TIDAK LAGI butuh pose kedua, dipakai ulang pose ini juga (lihat
  // isBackView di runFullPass di bawah), jadi cukup 1 fetch.
  const { data: posesRaw, error: posesError } = await supabase
    .from("ai_poses")
    .select("id, model_id, reference_image_url")
    .eq("id", input.poseId)
    .eq("model_id", input.modelId);
  const posesById = new Map((posesRaw ?? []).map((p) => [p.id, p]));
  if (posesError || !posesById.has(input.poseId)) {
    return NextResponse.json({ error: "Pose utama tidak ditemukan untuk model ini" }, { status: 404 });
  }

  // 1b. Ambil beberapa foto pose LAIN dari model yang sama sbg penguat
  // identitas (lihat IDENTITY_REFERENCE_COUNT) — dipakai ulang di semua
  // pemanggilan Nano Banana Pro dalam set ini (termasuk tiap foto seri).
  const { data: identityPoolRaw } = await supabase
    .from("ai_poses")
    .select("id, reference_image_url")
    .eq("model_id", input.modelId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(IDENTITY_REFERENCE_COUNT + 1);
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
  let angleFinalUrl: string | null = null;
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
    // REVISI #8 — "angle" pakai pose YANG SAMA dgn utama, dibedakan lewat
    // flag isBackView di prompt (lihat nano-banana-generate.ts), bukan lewat
    // pose_id kedua.
    const isBackView = role === "angle";
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
        isBackView,
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

  // --- Foto UTAMA (deliverable #1) ---
  utamaFinalUrl = await runFullPass(
    "utama",
    input.poseId,
    posesById.get(input.poseId)!.reference_image_url,
    primaryGarmentUrls
  );

  // --- Foto ANGLE (deliverable #2, badan penuh dari BELAKANG) — REVISI #8:
  // pakai pose YANG SAMA dgn utama (tidak ada pose_id kedua lagi), panggilan
  // Nano Banana Pro independen dgn flag isBackView=true supaya AI merender
  // scene yang sama dari sisi belakang model. ---
  angleFinalUrl = await runFullPass(
    "angle",
    input.poseId,
    posesById.get(input.poseId)!.reference_image_url,
    primaryGarmentUrls
  );

  // --- Foto SERI (varian warna lain, 0-6x, TIDAK termasuk 4-foto-tetap —
  // fitur terpisah/opsional): full pass independen, pose SAMA dengan utama
  // (supaya model/pose konsisten). REVISI #6: garmentUrls = SEMUA foto
  // warna utama (referensi bentuk/tekstur/bordir) + SATU foto full-body
  // warna target itu sendiri (referensi warna) — lihat klausa 2b di
  // nano-banana-generate.ts utk cara AI membedakan keduanya. ---
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

  // --- 2 crop close-up (bahan kolase_detail, REVISI #7) — diturunkan dari
  // utama lewat Kontext, SAMA seperti role "detail" versi lama, TAPI
  // sekarang TIDAK disimpan sbg baris ai_generations sendiri (cuma
  // variabel sementara) — lihat catatan REVISI #7 di header file. Biaya
  // tetap dihitung (totalCost) walau tidak tampil sbg item terpisah. ---
  let detailCropUrl1: string | null = null;
  let detailCropUrl2: string | null = null;
  if (utamaFinalUrl) {
    try {
      const crop1 = await runDetailCrop({
        baseImageUrl: utamaFinalUrl,
        focusArea: DETAIL_FOCUS_AREAS[0],
        seed: sharedSeed,
      });
      detailCropUrl1 = crop1.imageUrl;
      totalCost += COST_DERIVED;
    } catch {
      anyFailed = true;
    }
    try {
      const crop2 = await runDetailCrop({
        baseImageUrl: utamaFinalUrl,
        focusArea: DETAIL_FOCUS_AREAS[1],
        seed: sharedSeed,
      });
      detailCropUrl2 = crop2.imageUrl;
      totalCost += COST_DERIVED;
    } catch {
      anyFailed = true;
    }
  } else {
    anyFailed = true;
  }

  // --- KOLASE GABUNGAN (deliverable #3, REVISI #7) — cuma disusun kalau
  // utama DAN angle keduanya berhasil (butuh 2 foto). Render lokal via
  // next/og, TIDAK ADA biaya fal.ai tambahan. ---
  if (utamaFinalUrl && angleFinalUrl) {
    const { data: gen } = await supabase
      .from("ai_generations")
      .insert({ generation_set_id: set.id, image_role: "kolase_gabungan", status: "processing" })
      .select()
      .single();
    try {
      const startedAt = Date.now();
      const buffer = await renderKolaseGabunganPng({
        portraitUrl: utamaFinalUrl,
        fullBodyUrl: angleFinalUrl,
      });
      const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");
      await supabase
        .from("ai_generations")
        .update({
          output_image_url: url,
          has_stage2: false,
          status: "completed",
          generation_time_ms: Date.now() - startedAt,
          cost: 0,
        })
        .eq("id", gen!.id);
    } catch (err) {
      anyFailed = true;
      await supabase
        .from("ai_generations")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", gen!.id);
    }
  } else {
    anyFailed = true;
  }

  // --- KOLASE DETAIL (deliverable #4, REVISI #7) — cuma butuh utama + 2
  // crop close-up (tidak butuh angle). Render lokal via next/og, TIDAK ADA
  // biaya fal.ai tambahan. ---
  if (utamaFinalUrl && detailCropUrl1 && detailCropUrl2) {
    const { data: gen } = await supabase
      .from("ai_generations")
      .insert({ generation_set_id: set.id, image_role: "kolase_detail", status: "processing" })
      .select()
      .single();
    try {
      const startedAt = Date.now();
      const buffer = await renderKolaseDetailPng({
        mainUrl: utamaFinalUrl,
        detailUrl1: detailCropUrl1,
        detailUrl2: detailCropUrl2,
      });
      const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");
      await supabase
        .from("ai_generations")
        .update({
          output_image_url: url,
          has_stage2: false,
          status: "completed",
          generation_time_ms: Date.now() - startedAt,
          cost: 0,
        })
        .eq("id", gen!.id);
    } catch (err) {
      anyFailed = true;
      await supabase
        .from("ai_generations")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", gen!.id);
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
