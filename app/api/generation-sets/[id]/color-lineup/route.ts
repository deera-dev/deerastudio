// POST /api/generation-sets/:id/color-lineup — Agustus 2026.
// Admin: "tambahin 1 lagi ya untuk serian warna, saya mau masukin jadi 1
// foto aja digantung dengan hanger tanpa merubah detail sedikit pun,
// nantinya 1 produk tersebut akan bersandingan dengan produk yang sama,
// hanya serian warnanya saja yang berbeda". Lihat penjelasan lengkap
// (kenapa BUKAN panggilan AI) di types/database.ts (ImageRole "kolase_warna")
// & lib/image-template/color-lineup.tsx.
//
// Sumber foto per warna:
// - Warna utama -> set.product_images.fullBody (kalau ada) atau .front
//   (fallback wajib ada, satu-satunya field wajib di productImagesSchema).
//   Label warnanya set.product_warna, atau "Utama" kalau kosong.
// - Tiap warna seri -> baris ai_generations role "seri" milik set ini,
//   field variant_product_images.image (foto ASLI full-body yang diupload
//   admin utk warna itu — BUKAN output_image_url hasil generate AI-nya).
//   Label warnanya variant_warna.
// Baris "seri" yang gagal/belum selesai generate AI-nya TETAP ikut disini
// selama variant_product_images.image ada — lineup ini tidak bergantung
// sama sekali pada status generate AI role "seri".
//
// Idempotent per set: kalau set ini SUDAH pernah generate lineup (ada baris
// image_role="kolase_warna"), panggilan berikutnya nge-UPDATE baris yang
// sama (bukan bikin baris baru) — jadi admin bisa klik ulang kapan saja
// habis nambah warna seri baru tanpa numpuk baris kolase_warna.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderColorLineupPng, type ColorLineupEntry } from "@/lib/image-template/color-lineup";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import type { ProductImagesShape } from "@/lib/prompts/nano-banana-generate";

// Render foto (fetch beberapa gambar remote + Satori) — bukan panggilan AI,
// tapi tetap dikasih jatah lebih dari default Vercel (~10-15s) sbg jaga-jaga
// kalau storage/CDN foto lambat, konsisten dgn maxDuration di route lain.
export const maxDuration = 60;

type SetShape = {
  id: string;
  product_kode: string;
  product_images: ProductImagesShape;
  product_warna: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: setRaw, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("id, product_kode, product_images, product_warna")
    .eq("id", id)
    .single();
  if (setError || !setRaw) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  const set = setRaw as SetShape;

  const mainUrl = set.product_images.fullBody ?? set.product_images.front;
  if (!mainUrl) {
    return NextResponse.json(
      { error: "Set ini tidak punya foto warna utama tersimpan — tidak bisa buat lineup warna" },
      { status: 400 }
    );
  }

  const { data: seriRows } = await supabase
    .from("ai_generations")
    .select("variant_warna, variant_product_images, created_at")
    .eq("generation_set_id", id)
    .eq("image_role", "seri")
    .order("created_at", { ascending: true });

  const entries: ColorLineupEntry[] = [
    { url: mainUrl, label: set.product_warna || "Utama" },
    ...((seriRows ?? []) as { variant_warna: string | null; variant_product_images: Record<string, string> | null }[])
      .map((r) => {
        const url = r.variant_product_images?.image;
        return url ? { url, label: r.variant_warna || "Warna" } : null;
      })
      .filter((e): e is ColorLineupEntry => e !== null),
  ];

  if (entries.length < 2) {
    return NextResponse.json(
      {
        error:
          "Belum ada warna seri utk produk ini — tambah minimal 1 warna seri dulu (tombol \"Tambah Warna Seri\") sebelum buat lineup warna",
      },
      { status: 400 }
    );
  }

  try {
    const buffer = await renderColorLineupPng({ productKode: set.product_kode, entries });
    const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");

    // Idempotent — cari baris kolase_warna yang SUDAH ADA di set ini dulu.
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("id")
      .eq("generation_set_id", id)
      .eq("image_role", "kolase_warna")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("ai_generations")
        .update({ output_image_url: url, status: "completed", cost: 0, error_message: null })
        .eq("id", existing.id);
      return NextResponse.json({ generationId: existing.id, imageUrl: url });
    }

    const { data: created, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        generation_set_id: id,
        image_role: "kolase_warna",
        pose_id: null,
        variant_warna: null,
        variant_product_images: null,
        vto_image_url: null,
        output_image_url: url,
        has_stage2: true,
        status: "completed",
        generation_time_ms: null,
        cost: 0,
      })
      .select()
      .single();
    if (insertError || !created) {
      return NextResponse.json({ error: "Gagal menyimpan hasil lineup warna" }, { status: 500 });
    }

    return NextResponse.json({ generationId: created.id, imageUrl: url });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Gagal membuat lineup warna" },
      { status: 500 }
    );
  }
}
