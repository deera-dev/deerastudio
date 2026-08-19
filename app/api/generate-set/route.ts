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
// pilih pose) — ternyata itu bukan yang dimaksud admin. "Angle" disederhanakan
// jadi otomatis BELAKANG, tanpa perlu pilih pose sama sekali. Field request
// `anglePoseId` DIHAPUS total.
//
// REVISI #9 (Agustus 2026, segera setelah #8 gagal di tes nyata — hasil
// "angle" malah keluar foto DEPAN lagi, bukan belakang): pendekatan #8
// (pakai poseImageUrl yang SAMA dgn utama + instruksi teks isBackView di
// prompt) TERBUKTI tidak reliable — model AI (Nano Banana Pro) lebih niru
// struktur visual foto referensi pose drpd ikutin instruksi teks "putar ke
// belakang" secara konsisten. Fix: sekarang pakai FOTO REFERENSI ASLI yang
// benar-benar menunjukkan belakang model — admin tandai SATU pose per model
// sbg "Pose Belakang" (ai_poses.is_back_view, lihat app/poses/page.tsx),
// dilakukan SEKALI per model (bukan tiap generate, jadi tetap sesuai
// permintaan admin "ga usah pilih pose lagi" di level per-generate). Kalau
// model belum punya pose bertanda ini, generate-set GAGAL dgn error jelas
// drpd diam-diam menghasilkan foto depan lagi. Flag isBackView tetap dikirim
// (reinforcement tambahan di prompt), tapi sekarang DIPASANGKAN dengan foto
// referensi belakang yang genuin, bukan pengganti satu-satunya.
//
// REVISI #10 (Agustus 2026, post-mortem 500 error nyata — admin lapor
// "Failed to load resource: 500" + set tersangkut di 2/4 foto, "processing
// ga berhenti"): dicek lewat Supabase get_logs, penyebab ASLI ada di DB,
// bukan di logic REVISI #7-#9 di atas — migrasi yang nambah role
// "kolase_gabungan"/"kolase_detail" (REVISI #7) LUPA update CHECK
// constraint `ai_generations_image_role_check` di database (cuma
// TypeScript type & kode yang diupdate). Akibatnya SETIAP insert baris
// kolase_gabungan/kolase_detail gagal dgn Postgres 400, dan karena kode
// lama pakai `gen!.id` tanpa cek `error` hasil insert, request CRASH
// (uncaught TypeError) begitu insert gagal -> HTTP 500, set tersangkut
// permanen di status "processing". Fix waktu itu: (1) migration
// `ai_generations_image_role_add_kolase_roles` nambah 2 role itu ke
// constraint, (2) semua insert `ai_generations` cek `error`/`!gen`
// eksplisit sebelum lanjut.
//
// REVISI #11 (Agustus 2026, segera setelah #10 — admin: "ga sesuai yang
// saya mau deh, balik ke 2 foto aja, depan dan belakang, dah cukup"): admin
// menolak arah "4 foto tetap" (REVISI #7-#10) sepenuhnya. Set foto sekarang
// KEMBALI ke cuma 2 deliverable: "utama" (badan penuh, pose depan) & "angle"
// (badan penuh, otomatis dari belakang model — logic REVISI #9 TETAP
// dipakai, itu bukan bagian yang ditolak). Kolase gabungan, kolase detail,
// dan 2 crop close-up tersembunyi yang jadi bahan kolase_detail SEMUA
// DIHAPUS dari alur generate-set (tidak digenerate/disusun lagi sama
// sekali). Constraint DB & tipe TypeScript ImageRole SENGAJA TETAP
// mengizinkan "kolase_gabungan"/"kolase_detail" (TIDAK di-revert) — itu
// cuma utk kompatibilitas baca/regenerate riwayat LAMA yang sudah kadung
// punya baris kolase (lihat app/api/generations/[id]/regenerate/route.ts),
// bukan berarti fitur ini masih dipakai utk generate baru. lib/image-
// template/set-collage.tsx juga TIDAK dihapus, dgn alasan yang sama.
//
// REVISI BESAR (Agustus 2026, sepaket dgn rewrite prompt di lib/prompts/
// nano-banana-generate.ts — lihat header file itu utk latar belakang
// lengkap): collectGarmentUrls() lokal di file ini DIHAPUS, diganti
// collectGarmentReferences() yang dipusatkan di nano-banana-generate.ts —
// tiap foto produk sekarang bawa LABEL perannya (front/back/detail dada/
// dst), dipakai buildPrompt() utk susun "PRODUCT REFERENCE MAP" eksplisit.
// prioritizeUrl(string[]) juga diganti prioritizeReference(GarmentReference[])
// supaya label ikut pindah bareng saat foto "Belakang" diprioritaskan utk
// role "angle".
//
// POST /api/generate-set — PRD §15 & §7.6.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  runNanoBananaGenerate,
  prioritizeReference,
  collectGarmentReferences,
  type GarmentReference,
} from "@/lib/prompts/nano-banana-generate";
import { composeBackground, type BackgroundMode } from "@/lib/prompts/background-composer";
import type { AccessoryPresetRow, BackgroundPresetRow } from "@/types/database";
// REVISI #11 — runDetailCrop, renderKolaseGabunganPng/renderKolaseDetailPng,
// uploadBufferToStorage TIDAK dipakai lagi di file ini (kolase/crop close-up
// dihapus dari alur generate-set). Masih dipakai di app/api/generations/
// [id]/regenerate/route.ts utk kompatibilitas riwayat lama, sengaja TIDAK
// dihapus dari sana.

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

// Berapa banyak foto pose LAIN dari model yang sama dipakai sbg penguat
// identitas di tiap pemanggilan Nano Banana Pro (di luar foto pose target).
const IDENTITY_REFERENCE_COUNT = 2;

// Estimasi Rp per panggilan (kurs ~Rp17.900/USD, Agustus 2026):
// Nano Banana Pro $0.15/gambar (resolusi 1K) ~ Rp2.700.
const COST_FULL_PASS = 2700; // 1x Nano Banana Pro (utama, foto angle, DAN tiap foto seri)

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const input = body.data;

  const supabase = await createClient();

  // 1. Ambil pose utama — WAJIB milik model ini (§7.3).
  const { data: posesRaw, error: posesError } = await supabase
    .from("ai_poses")
    .select("id, model_id, reference_image_url")
    .eq("id", input.poseId)
    .eq("model_id", input.modelId);
  const posesById = new Map((posesRaw ?? []).map((p) => [p.id, p]));
  if (posesError || !posesById.has(input.poseId)) {
    return NextResponse.json({ error: "Pose utama tidak ditemukan untuk model ini" }, { status: 404 });
  }

  // 1a. REVISI #9 — ambil pose bertanda "Pose Belakang" (is_back_view) utk
  // model ini, dipakai sbg foto referensi ASLI utk "angle". GAGAL jelas
  // kalau belum ada, drpd diam-diam fallback ke pose depan (itu penyebab
  // bug REVISI #8: hasil "angle" keluar foto depan lagi).
  const { data: backPose } = await supabase
    .from("ai_poses")
    .select("id, reference_image_url")
    .eq("model_id", input.modelId)
    .eq("is_back_view", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!backPose) {
    return NextResponse.json(
      {
        error:
          "Model ini belum punya pose yang ditandai sbg \"Pose Belakang\" — tandai satu pose di halaman Poses dulu sebelum generate (dipakai otomatis utk foto Angle).",
      },
      { status: 400 }
    );
  }

  // 1b. Ambil beberapa foto pose LAIN dari model yang sama sbg penguat
  // identitas (lihat IDENTITY_REFERENCE_COUNT) — dipakai ulang di semua
  // pemanggilan Nano Banana Pro dalam set ini (termasuk tiap foto seri).
  // +2 (bukan +1) krn sekarang ada 2 pose "target" berbeda dlm 1 set (pose
  // utama & pose belakang) yang masing-masing perlu difilter keluar dari
  // pool saat generate foto itu sendiri.
  const { data: identityPoolRaw } = await supabase
    .from("ai_poses")
    .select("id, reference_image_url")
    .eq("model_id", input.modelId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(IDENTITY_REFERENCE_COUNT + 2);
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
  // Sekarang tiap entri bawa label perannya (lihat REVISI BESAR prompt map).
  const primaryGarmentReferences = collectGarmentReferences(input.productImages);

  let totalCost = 0;
  let anyFailed = false;
  let sharedSeed: number | undefined;

  // Jalankan Nano Banana Pro penuh untuk 1 pose + 1 set foto produk — dipakai
  // utama, tiap angle, DAN tiap warna seri (beda-beda garmentUrls/variant).
  async function runFullPass(
    role: "utama" | "angle" | "seri",
    poseId: string,
    poseImageUrl: string,
    garmentReferences: GarmentReference[],
    variantWarna?: string,
    variantProductImages?: Record<string, string>
  ) {
    // REVISI #9 — "angle" pakai pose_id BEDA dari utama lagi (backPose, foto
    // referensi ASLI belakang model), isBackView cuma reinforcement teks
    // tambahan di prompt (lihat nano-banana-generate.ts), bukan lagi
    // satu-satunya sinyal "ini harus jadi foto belakang".
    const isBackView = role === "angle";
    const { data: gen, error: genError } = await supabase
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
    // BUG FIX (Agustus 2026, post-mortem 500 error "4 foto tetap"): insert
    // di atas TIDAK melempar exception kalau gagal (mis. violates check
    // constraint) — supabase-js cuma isi field `error`, `gen` tetap
    // null/undefined. Kode lama langsung pakai `gen!.id` tanpa cek, jadi
    // kalau insert gagal, request CRASH (uncaught TypeError) -> HTTP 500,
    // dan generation_set tersangkut permanen di status "processing" krn
    // update status akhir di bawah tidak pernah tercapai. Sekarang cek
    // eksplisit & keluar bersih (anyFailed=true) kalau insert gagal.
    if (genError || !gen) {
      anyFailed = true;
      return null;
    }

    try {
      const identityReferenceUrls = identityPool
        .filter((url) => url !== poseImageUrl)
        .slice(0, IDENTITY_REFERENCE_COUNT);

      const result = await runNanoBananaGenerate({
        poseImageUrl,
        identityReferenceUrls,
        garmentReferences,
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
        .eq("id", gen.id);

      return result.imageUrl;
    } catch (err) {
      anyFailed = true;
      await supabase
        .from("ai_generations")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", gen.id);
      return null;
    }
  }

  // --- Foto UTAMA (deliverable #1, badan penuh dari DEPAN) ---
  await runFullPass(
    "utama",
    input.poseId,
    posesById.get(input.poseId)!.reference_image_url,
    primaryGarmentReferences
  );

  // --- Foto ANGLE (deliverable #2, badan penuh dari BELAKANG) — REVISI #9:
  // pakai pose bertanda "Pose Belakang" (backPose, foto referensi ASLI yang
  // menunjukkan belakang model) — BUKAN lagi pose utama + instruksi teks
  // (REVISI #8 terbukti tidak reliable). isBackView tetap dikirim sbg
  // reinforcement tambahan di prompt. REVISI #11 — ini SEKARANG deliverable
  // TERAKHIR dari set foto tetap (bukan lagi 2 dari 4) — kolase & crop
  // close-up yang dulu disusun sesudah ini SEMUA dihapus, lihat header
  // file. REVISI (fidelity, Agustus 2026) — foto produk "Belakang" (kalau
  // diupload) dipindah jadi gambar produk PERTAMA di array, menguatkan
  // klausa BACK VIEW REFERENCE PRIORITY di prompt lewat urutan gambar
  // juga, bukan cuma teks (lihat prioritizeReference di nano-banana-generate.ts). ---
  await runFullPass(
    "angle",
    backPose.id,
    backPose.reference_image_url,
    prioritizeReference(primaryGarmentReferences, input.productImages.back)
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
      [
        ...primaryGarmentReferences,
        {
          url: entry.image,
          label: `TARGET COLOR FULL-BODY FLAT-LAY ("${entry.warna}") — this is the specific colorway being generated in this photo; use ONLY to determine color/fabric shade, not construction (see clause 2b)`,
        },
      ],
      entry.warna,
      { image: entry.image }
    );
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
