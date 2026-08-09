// POST /api/generations/:id/regenerate — PRD §15.
// Generate ulang SATU gambar dalam sebuah set, tanpa mengulang seluruh set.
//
// - role "utama"/"angle" -> ulangi generate dari nol lewat Nano Banana Pro
//   ("Opsi B", Agustus 2026 — lihat catatan lengkap di
//   app/api/generate-set/route.ts & lib/prompts/nano-banana-generate.ts),
//   pakai pose_id yang tersimpan di baris generation itu sendiri. REVISI #9
//   (Agustus 2026 — REVISI #8 "angle pakai pose sama + instruksi teks"
//   terbukti tidak reliable, hasil "angle" malah keluar foto depan lagi):
//   baris "angle" yang baru dibuat lewat generate-set/route.ts sekarang
//   menyimpan pose_id milik pose yang ditandai "Pose Belakang"
//   (ai_poses.is_back_view, lihat app/poses/page.tsx) — foto referensi ASLI
//   yang menunjukkan belakang model, BUKAN lagi pose yang sama dgn "utama".
//   isBackView tetap dikirim sbg reinforcement teks tambahan di prompt.
//   CATATAN kompatibilitas: baris "angle" LAMA (dibuat sebelum REVISI #9,
//   saat pose_id-nya masih sama dgn "utama") akan tetap regenerate pakai
//   pose depan itu lagi kalau di-regenerate lewat endpoint ini — kalau ada
//   set lama begini, generate ulang seluruh set dari awal drpd regenerate
//   satu-satu.
//   CATATAN: kalau utama diregenerate, foto detail/seri yang lain jadi tidak
//   sinkron lagi (masih diturunkan/pakai data dari utama versi lama) —
//   regenerate juga detail/seri terkait setelahnya kalau perlu.
// - role "detail" -> diturunkan ulang dari foto UTAMA yang aktif saat ini
//   lewat Kontext crop/zoom, sama seperti alur generate-set.
// - role "seri" -> REVISI Agustus 2026 (final, hemat-foto): BUKAN recolor
//   dari foto utama, dan BUKAN lagi 7 slot foto per warna — generate ulang
//   FULL & independen lewat Nano Banana Pro, pakai SEMUA foto warna utama
//   set ini (set.product_images, referensi bentuk/tekstur/bordir) + SATU
//   foto full-body warna itu sendiri yang tersimpan di
//   variant_product_images.image (baris generation itu sendiri, referensi
//   warna) + pose UTAMA set ini (set.pose_id), sama seperti alur
//   generate-set/route.ts. Prompt dikasih flag isColorVariant=true supaya
//   AI tahu cara membedakan referensi warna vs referensi konstruksi (lihat
//   klausa 2b di lib/prompts/nano-banana-generate.ts).
// - role "kolase_gabungan"/"kolase_detail" (BARU Agustus 2026, "4 foto
//   tetap", lihat app/api/generate-set/route.ts REVISI #7) -> BUKAN
//   panggilan AI, cuma disusun ULANG (next/og) dari foto utama/angle yang
//   SEDANG AKTIF di set ini. kolase_gabungan butuh utama+angle; kolase_detail
//   generate ulang 2 crop close-up dari utama (Kontext) lalu disusun ulang
//   — 2 crop itu TIDAK disimpan sbg baris sendiri (konsisten dgn alur
//   generate-set awal).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runNanoBananaGenerate } from "@/lib/prompts/nano-banana-generate";
import { runDetailCrop } from "@/lib/prompts/stage2";
import { composeBackground, type BackgroundMode } from "@/lib/prompts/background-composer";
import { renderKolaseGabunganPng, renderKolaseDetailPng } from "@/lib/image-template/set-collage";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import type { BackgroundPresetRow, Generation } from "@/types/database";

const DETAIL_FOCUS_AREAS = [
  "collar and neckline embroidery",
  "sleeve cuff and sleeve embroidery detail",
  "fabric texture and embroidery pattern on the torso",
];
// Sama seperti generate-set/route.ts — jumlah foto pose lain dari model yang
// sama dipakai sbg penguat identitas.
const IDENTITY_REFERENCE_COUNT = 2;

// Estimasi Rp — Nano Banana Pro $0.15/gambar (resolusi 1K) ~ Rp2.700.
const COST_FULL_PASS = 2700;
const COST_DERIVED = 640;

type ProductImagesShape = {
  front: string;
  back?: string;
  detailNeck?: string;
  detailSleeve?: string;
  detailHand?: string;
  detailChest?: string;
  detailHem?: string;
  fullBody?: string;
};

function collectGarmentUrls(images: ProductImagesShape) {
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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: gen, error: genError } = await supabase
    .from("ai_generations")
    .select("*, ai_generation_sets(*)")
    .eq("id", id)
    .single();
  if (genError || !gen) {
    return NextResponse.json({ error: "Generation tidak ditemukan" }, { status: 404 });
  }

  const set = gen.ai_generation_sets as {
    id: string;
    model_id: string;
    pose_id: string;
    product_images: ProductImagesShape;
    background_mode: BackgroundMode;
    background_preset_id: string | null;
    product_warna: string | null;
  };

  await supabase.from("ai_generations").update({ status: "processing" }).eq("id", id);

  try {
    if (gen.image_role === "utama" || gen.image_role === "angle" || gen.image_role === "seri") {
      const isSeri = gen.image_role === "seri";
      const variantImages = gen.variant_product_images as Record<string, string> | null;
      if (isSeri && !variantImages?.image) {
        throw new Error(
          "Baris seri ini tidak punya foto warna (variant_product_images.image) — tidak bisa di-regenerate"
        );
      }

      // Seri selalu pakai pose UTAMA set ini (bukan pose_id sendiri, kolom
      // itu null utk role seri) — konsisten dgn generate-set/route.ts.
      const poseId = isSeri ? set.pose_id : gen.pose_id ?? set.pose_id; // fallback utk baris utama/angle lama sebelum kolom pose_id ada
      const { data: pose } = await supabase
        .from("ai_poses")
        .select("reference_image_url")
        .eq("id", poseId)
        .single();

      const { data: identityPoolRaw } = await supabase
        .from("ai_poses")
        .select("reference_image_url")
        .eq("model_id", set.model_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(IDENTITY_REFERENCE_COUNT + 3);
      const identityReferenceUrls = (identityPoolRaw ?? [])
        .map((p) => p.reference_image_url)
        .filter((url) => url !== pose!.reference_image_url)
        .slice(0, IDENTITY_REFERENCE_COUNT);

      const { data: presetsRaw } = await supabase
        .from("ai_background_presets")
        .select("*")
        .eq("is_active", true);

      const background = composeBackground({
        mode: set.background_mode,
        productWarna: set.product_warna ?? undefined,
        presets: (presetsRaw ?? []) as BackgroundPresetRow[],
        forcedPresetId: set.background_preset_id ?? undefined,
      });

      // REVISI hemat-foto: utk seri, garmentImageUrls = SEMUA foto warna
      // utama (referensi bentuk/tekstur/bordir) + SATU foto warna target itu
      // sendiri (referensi warna) — sama seperti generate-set/route.ts.
      const garmentImageUrls = isSeri
        ? [...collectGarmentUrls(set.product_images), variantImages!.image]
        : collectGarmentUrls(set.product_images);

      const result = await runNanoBananaGenerate({
        poseImageUrl: pose!.reference_image_url,
        identityReferenceUrls,
        garmentImageUrls,
        backgroundDescription: background.description,
        productWarna: isSeri ? gen.variant_warna ?? undefined : set.product_warna ?? undefined,
        isColorVariant: isSeri,
        // REVISI #8 — "angle" pakai pose YANG SAMA dgn utama (poseId di atas
        // sudah fallback ke set.pose_id), dibedakan lewat flag ini supaya AI
        // merender ulang scene yang sama dari sisi belakang model.
        isBackView: gen.image_role === "angle",
      });

      await supabase
        .from("ai_generations")
        .update({
          vto_image_url: null,
          output_image_url: result.imageUrl,
          status: "completed",
          generation_time_ms: result.generationTimeMs,
          cost: COST_FULL_PASS,
        })
        .eq("id", id);

      return NextResponse.json({ status: "completed", imageUrl: result.imageUrl });
    }

    // role "kolase_gabungan" — susun ULANG dari foto utama+angle yang SEDANG
    // AKTIF di set ini (bukan panggilan AI, cost tetap 0).
    if (gen.image_role === "kolase_gabungan") {
      const { data: utamaRow } = await supabase
        .from("ai_generations")
        .select("output_image_url")
        .eq("generation_set_id", set.id)
        .eq("image_role", "utama")
        .single();
      const { data: angleRow } = await supabase
        .from("ai_generations")
        .select("output_image_url")
        .eq("generation_set_id", set.id)
        .eq("image_role", "angle")
        .single();

      if (!utamaRow?.output_image_url || !angleRow?.output_image_url) {
        throw new Error(
          "Foto utama/angle pada set ini belum ada/gagal — regenerate utama & angle dulu"
        );
      }

      const buffer = await renderKolaseGabunganPng({
        portraitUrl: utamaRow.output_image_url,
        fullBodyUrl: angleRow.output_image_url,
      });
      const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");

      await supabase
        .from("ai_generations")
        .update({
          vto_image_url: null,
          output_image_url: url,
          status: "completed",
          generation_time_ms: null,
          cost: 0,
        })
        .eq("id", id);

      return NextResponse.json({ status: "completed", imageUrl: url });
    }

    // role "kolase_detail" — generate ulang 2 crop close-up dari foto utama
    // yang SEDANG AKTIF (Kontext, sama seperti alur generate-set awal), lalu
    // susun ulang jadi kolase. 2 crop itu TIDAK disimpan sbg baris sendiri.
    if (gen.image_role === "kolase_detail") {
      const { data: utamaRow } = await supabase
        .from("ai_generations")
        .select("output_image_url")
        .eq("generation_set_id", set.id)
        .eq("image_role", "utama")
        .single();

      if (!utamaRow?.output_image_url) {
        throw new Error("Foto utama pada set ini belum ada/gagal — regenerate utama dulu");
      }

      const [crop1, crop2] = await Promise.all([
        runDetailCrop({ baseImageUrl: utamaRow.output_image_url, focusArea: DETAIL_FOCUS_AREAS[0] }),
        runDetailCrop({ baseImageUrl: utamaRow.output_image_url, focusArea: DETAIL_FOCUS_AREAS[1] }),
      ]);

      const buffer = await renderKolaseDetailPng({
        mainUrl: utamaRow.output_image_url,
        detailUrl1: crop1.imageUrl,
        detailUrl2: crop2.imageUrl,
      });
      const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");

      await supabase
        .from("ai_generations")
        .update({
          vto_image_url: null,
          output_image_url: url,
          status: "completed",
          generation_time_ms: (crop1.generationTimeMs ?? 0) + (crop2.generationTimeMs ?? 0),
          // 2 crop tersembunyi tetap pakai fal.ai (Kontext) — cost regenerate
          // ini mencerminkan biaya nyata, beda dgn kolase_gabungan yg murni 0.
          cost: COST_DERIVED * 2,
        })
        .eq("id", id);

      return NextResponse.json({ status: "completed", imageUrl: url });
    }

    // role "detail" — turunkan ulang dari foto utama yang sedang aktif
    const { data: utama } = await supabase
      .from("ai_generations")
      .select("output_image_url")
      .eq("generation_set_id", set.id)
      .eq("image_role", "utama")
      .single();

    if (!utama?.output_image_url) {
      throw new Error("Foto utama pada set ini belum ada/gagal — regenerate utama dulu");
    }

    const { data: siblings } = await supabase
      .from("ai_generations")
      .select("id, created_at")
      .eq("generation_set_id", set.id)
      .eq("image_role", "detail")
      .order("created_at", { ascending: true });
    const index = (siblings as Pick<Generation, "id" | "created_at">[] | null)?.findIndex(
      (g) => g.id === id
    );
    const focusArea =
      index !== undefined && index >= 0 && index < DETAIL_FOCUS_AREAS.length
        ? DETAIL_FOCUS_AREAS[index]
        : DETAIL_FOCUS_AREAS[0];

    const crop = await runDetailCrop({ baseImageUrl: utama.output_image_url, focusArea });

    await supabase
      .from("ai_generations")
      .update({
        vto_image_url: null,
        output_image_url: crop.imageUrl,
        status: "completed",
        generation_time_ms: crop.generationTimeMs,
        cost: COST_DERIVED,
      })
      .eq("id", id);

    return NextResponse.json({ status: "completed", imageUrl: crop.imageUrl });
  } catch (err) {
    await supabase
      .from("ai_generations")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", id);
    return NextResponse.json({ error: "Regenerate gagal" }, { status: 500 });
  }
}
