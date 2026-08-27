// PATCH /api/generation-sets/:id/color-reference — Agustus 2026.
// Admin (lihat halaman /lineup-warna): "kok gini sih, upload ulang aja,
// mana salah pula mending kalau bener fotonya" — sambil melihat referensi
// warna 1 produk yang framing-nya tidak konsisten (campur hanger/mannequin/
// flat-lay) dan salah satu foto SALAH (foto tidak cocok dgn warna
// labelnya). Sebelumnya, satu-satunya cara ganti foto referensi warna
// adalah lewat History (foto utama tidak ada jalur edit sama sekali; foto
// seri cuma bisa ADD baru, bukan REPLACE yang sudah ada). Endpoint ini
// kasih jalan pintas ganti foto LANGSUNG dari halaman Lineup Warna, tanpa
// generate ulang apa pun — cuma menimpa URL foto referensi yang dipakai.
//
// - kind "main" -> foto warna UTAMA produk (ai_generation_sets.product_images).
//   Field JSONB ini punya BEBERAPA slot foto (front/back/detail*/fullBody);
//   endpoint ini HANYA menimpa slot yang SUDAH terisi & dipakai sbg
//   referensi warna utama (fullBody kalau ada, kalau tidak baru front) —
//   supaya tidak sengaja menghapus slot lain yang tidak terkait lineup
//   warna (mis. detailNeck/detailSleeve masih dipakai jalur generate lain).
// - kind "seri" -> foto 1 warna seri (ai_generations.variant_product_images.
//   image, baris role "seri" milik set ini, ditunjuk via generationId).
//
// Ganti foto TIDAK otomatis regenerate lineup yang sudah ada (kalau ada) —
// admin perlu klik "Buat Ulang Lineup" manual di halaman Lineup Warna
// supaya AI pakai foto baru ini.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ProductImagesShape } from "@/lib/prompts/nano-banana-generate";

const requestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("main"), imageUrl: z.string().url() }),
  z.object({ kind: z.literal("seri"), generationId: z.string().uuid(), imageUrl: z.string().url() }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();

  if (body.data.kind === "main") {
    const { data: setRaw, error: setError } = await supabase
      .from("ai_generation_sets")
      .select("id, product_images")
      .eq("id", id)
      .single();
    if (setError || !setRaw) {
      return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
    }
    const productImages = (setRaw as { product_images: ProductImagesShape }).product_images;
    const key: keyof ProductImagesShape = productImages.fullBody ? "fullBody" : "front";
    const updated: ProductImagesShape = { ...productImages, [key]: body.data.imageUrl };

    const { error: updateError } = await supabase
      .from("ai_generation_sets")
      .update({ product_images: updated })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: "Gagal menyimpan foto baru" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // kind === "seri" — pastikan baris ini benar milik set ini & role "seri"
  // supaya endpoint ini tidak bisa dipakai menimpa baris sembarangan.
  const { data: genRaw, error: genError } = await supabase
    .from("ai_generations")
    .select("id, generation_set_id, image_role")
    .eq("id", body.data.generationId)
    .single();
  if (
    genError ||
    !genRaw ||
    genRaw.generation_set_id !== id ||
    genRaw.image_role !== "seri"
  ) {
    return NextResponse.json({ error: "Baris warna seri tidak ditemukan" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("ai_generations")
    .update({ variant_product_images: { image: body.data.imageUrl } })
    .eq("id", body.data.generationId);
  if (updateError) {
    return NextResponse.json({ error: "Gagal menyimpan foto baru" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
