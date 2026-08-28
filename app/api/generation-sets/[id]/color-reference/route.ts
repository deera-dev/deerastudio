// PATCH /api/generation-sets/:id/color-reference — Agustus 2026.
// Admin (lihat halaman /lineup-warna): "kok gini sih, upload ulang aja,
// mana salah pula mending kalau bener fotonya" — sambil melihat referensi
// warna 1 produk yang framing-nya tidak konsisten (campur hanger/mannequin/
// flat-lay) dan salah satu foto SALAH (foto tidak cocok dgn warna
// labelnya). Endpoint ini kasih jalan pintas ganti foto warna UTAMA
// LANGSUNG dari halaman Lineup Warna, tanpa generate ulang apa pun — cuma
// menimpa URL foto referensi yang dipakai.
//
// Field JSONB product_images punya BEBERAPA slot foto (front/back/detail*/
// fullBody); endpoint ini HANYA menimpa slot yang SUDAH terisi & dipakai
// sbg referensi warna utama (fullBody kalau ada, kalau tidak baru front) —
// supaya tidak sengaja menghapus slot lain yang tidak terkait lineup warna
// (mis. detailNeck/detailSleeve masih dipakai jalur generate lain).
//
// REVISI BESAR (Agustus 2026 — admin: "saya punya foto asli flat ray
// originalnya... saya bisa hanya attach foto asli flat ray masing-masing
// warnanya", boros kredit kalau tiap warna wajib generate model dulu):
// endpoint ini DULU juga punya cabang kind="seri" yang menimpa
// ai_generations.variant_product_images (baris hasil "Tambah Warna Seri" di
// History, yang MEWAJIBKAN generate model penuh dulu lewat Nano Banana
// Pro). Lineup Warna sekarang TIDAK bergantung pada baris "seri" itu sama
// sekali — warna-warna tambahan dikelola sbg foto flat-lay ASLI langsung di
// ai_generation_sets.lineup_color_refs (lihat app/api/generation-sets/[id]/
// lineup-color-refs/route.ts utk add/replace/remove-nya). Endpoint INI
// dipersempit jadi HANYA utk foto warna utama.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ProductImagesShape } from "@/lib/prompts/nano-banana-generate";

const requestSchema = z.object({ imageUrl: z.string().url() });

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
