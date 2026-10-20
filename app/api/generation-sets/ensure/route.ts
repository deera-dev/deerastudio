// POST /api/generation-sets/ensure — Oktober 2026.
// Admin: picker produk di /lineup-warna ("Katalog Warna") dulu hanya
// menampilkan baris yang SUDAH ADA di ai_generation_sets, jadi produk yang
// belum pernah diproses lewat AI Fashion Studio tidak pernah muncul sama
// sekali (bukan soal limit — datanya memang tidak ada). Supaya SEMUA produk
// bisa dipilih & langsung diupload seri warnanya tanpa generate AI dulu,
// halaman itu sekarang juga menampilkan produk langsung dari tabel
// `products`; begitu admin melakukan aksi tulis pertama (upload foto utama
// atau tambah warna) terhadap produk yang belum punya baris, endpoint ini
// dipanggil utk membuat baris "wadah" kosong — model_id/pose_id dikosongkan
// (nullable di DB, lihat migrasi init) krn fitur Lineup Warna sendiri tidak
// pernah membaca kedua field itu (lihat color-lineup/route.ts). status
// dipaksa "completed" (bukan default "queued") supaya tidak salah terlihat
// sbg job yang masih berjalan di Dashboard/History.
//
// Idempotent per product_kode: dipanggil ulang utk produk yang sudah punya
// baris wadah (model_id & pose_id masih null) akan reuse baris itu, bukan
// bikin duplikat.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/api-error";

const requestSchema = z.object({ productKode: z.string().trim().min(1) });

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: zodErrorMessage(body.error) }, { status: 400 });
  }
  const { productKode } = body.data;

  const supabase = await createClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("kode, image")
    .eq("kode", productKode)
    .single();
  if (productError || !product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("ai_generation_sets")
    .select("id")
    .eq("product_kode", productKode)
    .is("model_id", null)
    .is("pose_id", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  const { data: created, error: insertError } = await supabase
    .from("ai_generation_sets")
    .insert({
      product_kode: productKode,
      product_images: { front: product.image ?? "" },
      status: "completed",
    })
    .select("id")
    .single();
  if (insertError || !created) {
    return NextResponse.json({ error: "Gagal menyiapkan data produk" }, { status: 500 });
  }
  return NextResponse.json({ id: created.id });
}
