// POST /api/generation-sets/:id/publish — PRD §15 (v0.4) & §17.
// Push gambar terpilih ke Cloudinary, lalu update products.image/detail/video
// di project Supabase Deera yang sama. Pakai service-role client karena ini
// nulis ke tabel Deera existing (products) — TIDAK pernah dipanggil dari
// client langsung, hanya lewat route ini (server-only, §17).
//
// REVISI Agustus 2026 ("seri" = varian warna, foto asli per warna): dulu
// hanya ada MAKSIMAL 1 baris "seri" per set (recolor tunggal) yang ditulis
// ke products.seri_warna (kolom lama, teks tunggal). Sekarang satu set bisa
// punya BANYAK baris "seri" (satu per warna varian, masing-masing full
// independent generation dari foto asli warna itu — lihat generate-set/route.ts
// & app/generate/page.tsx). Publish sekarang menulis SEMUA seri yang completed
// ke products.warna_images (jsonb, di-merge per warna dengan isi yang sudah
// ada — bukan overwrite total, supaya publish parsial/berulang aman). Kolom
// lama products.seri_warna TIDAK lagi ditulis dari sini — dibiarkan apa
// adanya untuk produk lama yang masih dipublish sebelum migrasi ini
// (katalog fallback ke seri_warna kalau warna_images kosong, lihat
// apps/catalog/src/features/product-detail di monorepo deeraindonesia).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { publishGenerationSet, PublishValidationError } from "@/lib/publish/publishGenerationSet";

const requestSchema = z.object({
  imageIds: z.object({
    utama: z.string().uuid(),
    // Sebelumnya wajib persis 3 — sekarang jumlah foto detail/angle per set
    // bisa diatur (0-3 detail + sampai 3 angle), jadi panjangnya fleksibel.
    detail: z.array(z.string().uuid()).min(0).max(6),
    // REVISI: dulu 1 uuid opsional (recolor tunggal), sekarang array — satu
    // per warna varian yang mau dipublish sekaligus.
    seri: z.array(z.string().uuid()).min(0).max(6).default([]),
  }),
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

  const supabase = await createClient(); // untuk baca data + auth check
  const service = createServiceRoleClient(); // untuk tulis ke products (bypass RLS)

  const { data: set } = await supabase
    .from("ai_generation_sets")
    .select("id, product_kode")
    .eq("id", id)
    .single();
  if (!set) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }

  try {
    const result = await publishGenerationSet(supabase, service, id, set.product_kode, body.data.imageIds);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PublishValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
