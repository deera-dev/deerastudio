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
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, product_kode")
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

  return NextResponse.json({ oldKode: set.product_kode, newKode: targetProduct.kode, newNama: targetProduct.nama });
}
