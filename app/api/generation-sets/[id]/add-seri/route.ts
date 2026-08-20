// POST /api/generation-sets/:id/add-seri — Agustus 2026.
// Tambah SATU/BEBERAPA warna seri baru ke generation set yang SUDAH ADA
// (biasanya foto utama-nya sudah completed & bahkan sudah dipublish), TANPA
// re-generate foto utama/angle sama sekali — beda dari POST /api/generate-set
// yang selalu generate utama dari nol.
//
// LATAR BELAKANG: kalau foto utama sebuah produk sudah jadi & sudah
// dipublish, lalu admin baru mau nambahin warna lain belakangan, submit
// ulang lewat form Generate akan boros — form itu selalu generate ulang
// utama (dan angle kalau ada) juga, padahal sudah tidak perlu.
//
// Endpoint ini reuse SEMUANYA yang sudah tersimpan di generation set itu:
// foto flat-lay warna utama (set.product_images, jadi referensi bentuk/
// tekstur/bordir — sama seperti REVISI hemat-foto di generate-set/route.ts),
// pose utama (set.pose_id), model (set.model_id), background
// (set.background_description, dibuat SEKALI saat set ini dibuat, TIDAK
// dihitung ulang), dan aksesoris (set.accessory_preset_ids). Admin cukup
// upload SATU foto full-body per warna baru — biaya cuma Rp2.700/warna,
// tanpa nyentuh baris "utama" sama sekali.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  runNanoBananaGenerate,
  collectGarmentReferences,
  type ProductImagesShape,
} from "@/lib/prompts/nano-banana-generate";
import type { AccessoryPresetRow } from "@/types/database";

// BUG FIX (Agustus 2026) — sama seperti app/api/generate-set/route.ts &
// app/api/generations/[id]/regenerate/route.ts: endpoint ini juga panggil
// fal.subscribe scr sinkron per warna dalam 1 request tanpa `maxDuration`
// eksplisit, berisiko sama (baris stuck di "processing" kalau function
// di-kill platform di tengah jalan).
export const maxDuration = 300;

const requestSchema = z.object({
  seriEntries: z
    .array(z.object({ warna: z.string(), image: z.string().url() }))
    .min(1)
    .max(6),
});

// Sama seperti generate-set/route.ts & regenerate/route.ts.
const IDENTITY_REFERENCE_COUNT = 2;
const COST_FULL_PASS = 2700;

type SetShape = {
  id: string;
  product_kode: string;
  model_id: string;
  pose_id: string;
  product_images: ProductImagesShape;
  product_warna: string | null;
  background_description: string | null;
  accessory_preset_ids: string[] | null;
  total_cost: number | null;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: setRaw, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("*")
    .eq("id", id)
    .single();
  if (setError || !setRaw) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  const set = setRaw as SetShape;

  const primaryGarmentReferences = collectGarmentReferences(set.product_images);
  if (primaryGarmentReferences.length === 0) {
    return NextResponse.json(
      { error: "Set ini tidak punya foto warna utama tersimpan — tidak bisa tambah seri" },
      { status: 400 }
    );
  }

  const { data: pose } = await supabase
    .from("ai_poses")
    .select("reference_image_url")
    .eq("id", set.pose_id)
    .single();
  if (!pose) {
    return NextResponse.json({ error: "Pose utama set ini tidak ditemukan" }, { status: 404 });
  }

  // Penguat identitas — foto pose LAIN dari model yang sama, sama seperti
  // pemanggilan Nano Banana Pro lainnya di app ini.
  const { data: identityPoolRaw } = await supabase
    .from("ai_poses")
    .select("reference_image_url")
    .eq("model_id", set.model_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(IDENTITY_REFERENCE_COUNT + 3);
  const identityReferenceUrls = (identityPoolRaw ?? [])
    .map((p) => p.reference_image_url)
    .filter((url) => url !== pose.reference_image_url)
    .slice(0, IDENTITY_REFERENCE_COUNT);

  const { data: accessoriesRaw } = set.accessory_preset_ids?.length
    ? await supabase.from("ai_accessory_presets").select("*").in("id", set.accessory_preset_ids)
    : { data: [] as AccessoryPresetRow[] };
  const accessories = (accessoriesRaw ?? []) as AccessoryPresetRow[];

  let addedCost = 0;
  let anyFailed = false;
  const created: { warna: string; generationId: string; imageUrl: string | null }[] = [];

  for (const entry of body.data.seriEntries) {
    const { data: gen } = await supabase
      .from("ai_generations")
      .insert({
        generation_set_id: set.id,
        image_role: "seri",
        pose_id: null,
        variant_warna: entry.warna,
        variant_product_images: { image: entry.image },
        status: "processing",
      })
      .select()
      .single();

    try {
      const result = await runNanoBananaGenerate({
        poseImageUrl: pose.reference_image_url,
        identityReferenceUrls,
        garmentReferences: [
          ...primaryGarmentReferences,
          {
            url: entry.image,
            label: `TARGET COLOR FULL-BODY FLAT-LAY ("${entry.warna}") — this is the specific colorway being generated in this photo; use ONLY to determine color/fabric shade, not construction (see clause 2b)`,
          },
        ],
        // Background yang SAMA dgn foto utama set ini — dibuat sekali saat
        // set dibuat, TIDAK dihitung ulang lewat composeBackground() lagi
        // supaya scene tetap konsisten dgn foto utama/angle yang sudah ada.
        backgroundDescription: set.background_description ?? "",
        productWarna: entry.warna,
        accessoryPromptFragments: accessories.map((a) => a.prompt_fragment),
        isColorVariant: true,
      });

      addedCost += COST_FULL_PASS;

      await supabase
        .from("ai_generations")
        .update({
          output_image_url: result.imageUrl,
          has_stage2: true,
          status: "completed",
          generation_time_ms: result.generationTimeMs,
          cost: COST_FULL_PASS,
        })
        .eq("id", gen!.id);

      created.push({ warna: entry.warna, generationId: gen!.id, imageUrl: result.imageUrl });
    } catch (err) {
      anyFailed = true;
      await supabase
        .from("ai_generations")
        .update({ status: "failed", error_message: (err as Error).message })
        .eq("id", gen!.id);
      created.push({ warna: entry.warna, generationId: gen!.id, imageUrl: null });
    }
  }

  // Status set HANYA diturunkan (completed -> partial) kalau ada yang gagal
  // — tidak pernah dinaikkan otomatis, karena status merefleksikan hasil
  // utama/angle/detail ASLI, bukan seri yang ditambahkan belakangan.
  const newStatus = anyFailed && set.status === "completed" ? "partial" : set.status;

  await supabase
    .from("ai_generation_sets")
    .update({
      total_cost: (set.total_cost ?? 0) + addedCost,
      status: newStatus,
    })
    .eq("id", set.id);

  return NextResponse.json({ created, anyFailed });
}
