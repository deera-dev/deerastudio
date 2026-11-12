// POST /api/generation-sets/:id/transfer — pindahkan generation set ke kode
// produk lain, TANPA generate ulang foto sama sekali.
//
// Use case: admin salah masukin kode produk saat generate (foto yang keluar
// sebenarnya buat kode A, tapi ke-link ke kode B) — sebelum fitur ini,
// satu-satunya cara benerin adalah generate ulang dari nol (boros kredit AI).
// Endpoint ini cuma ganti ai_generation_sets.product_kode — foto
// (ai_generations) sama sekali tidak disentuh, snapshot product_images/
// product_warna juga TIDAK diubah (itu referensi bentuk/warna garment yang
// difoto, tetap valid terlepas dari kode mana yang terhubung).
//
// REVISI (November 2026, admin: "kenapa harus publish manual ya? saya mau
// bisa otomatis juga") — kalau set yang dipindah SUDAH pernah dipublish
// sebelumnya (published_at terisi), endpoint ini otomatis publish ULANG ke
// kode BARU lewat publishGenerationSet() (sama logic dgn tombol "Publish ke
// Katalog" manual), pakai seleksi gambar default (deriveDefaultImageIds —
// utama + semua detail/seri, sama seperti yang otomatis dipilih
// handlePublish() di app/history/page.tsx). TIDAK mengubah/membersihkan
// katalog kode LAMA — tidak ada cara aman tahu foto apa yang ada di sana
// sebelum publish yang salah itu, jadi itu tetap perlu dicek manual oleh
// admin kalau perlu.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  publishGenerationSet,
  deriveDefaultImageIds,
  PublishValidationError,
} from "@/lib/publish/publishGenerationSet";

const requestSchema = z.object({
  newKode: z.string().trim().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const newKode = body.data.newKode;

  const supabase = await createClient();

  const { data: set } = await supabase
    .from("ai_generation_sets")
    .select("id, product_kode, published_at")
    .eq("id", id)
    .single();
  if (!set) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  if (set.product_kode === newKode) {
    return NextResponse.json({ error: "Set ini sudah terhubung ke kode itu" }, { status: 400 });
  }

  const { data: targetProduct } = await supabase
    .from("products")
    .select("kode, nama")
    .eq("kode", newKode)
    .single();
  if (!targetProduct) {
    return NextResponse.json({ error: `Kode produk "${newKode}" tidak ditemukan` }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("ai_generation_sets")
    .update({ product_kode: newKode })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Gagal memindahkan set ke produk baru" }, { status: 500 });
  }

  // Set ini belum pernah dipublish sebelumnya — tidak ada yang perlu
  // dipublish ulang, selesai di sini.
  if (!set.published_at) {
    return NextResponse.json({
      oldKode: set.product_kode,
      newKode: targetProduct.kode,
      newNama: targetProduct.nama,
      republished: false,
    });
  }

  const { data: generations } = await supabase
    .from("ai_generations")
    .select("id, image_role, status")
    .eq("generation_set_id", id);

  const derived = deriveDefaultImageIds(generations ?? []);
  if (!derived || !derived.allCompleted) {
    // Set ini sudah pernah dipublish, tapi sekarang punya baris yang belum
    // completed (mis. sedang regenerate) — jangan publish ulang otomatis
    // dgn data tidak lengkap, biarkan admin publish manual setelah semua
    // selesai.
    return NextResponse.json({
      oldKode: set.product_kode,
      newKode: targetProduct.kode,
      newNama: targetProduct.nama,
      republished: false,
      republishSkippedReason:
        "Ada foto yang belum selesai digenerate — publish ulang otomatis dilewati, publish manual setelah semua foto completed.",
    });
  }

  try {
    const service = createServiceRoleClient();
    await publishGenerationSet(supabase, service, id, targetProduct.kode, derived.imageIds);
    return NextResponse.json({
      oldKode: set.product_kode,
      newKode: targetProduct.kode,
      newNama: targetProduct.nama,
      republished: true,
    });
  } catch (err) {
    // Transfer kode-nya sendiri SUDAH berhasil di atas — publish ulang yang
    // gagal jangan bikin seluruh request ini dianggap gagal, cukup kasih
    // tau admin supaya publish manual.
    return NextResponse.json({
      oldKode: set.product_kode,
      newKode: targetProduct.kode,
      newNama: targetProduct.nama,
      republished: false,
      republishSkippedReason:
        err instanceof PublishValidationError ? err.message : "Publish ulang otomatis gagal, publish manual.",
    });
  }
}
