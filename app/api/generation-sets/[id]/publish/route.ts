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
import { uploadPublishedImage } from "@/lib/cloudinary/client";

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

// Slugify nama warna supaya aman dipakai sbg Cloudinary public_id (folder
// path), mis. "MERAH MARUN" -> "merah-marun".
function slugifyWarna(warna: string) {
  return warna
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

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

  const allIds = [
    body.data.imageIds.utama,
    ...body.data.imageIds.detail,
    ...body.data.imageIds.seri,
  ];
  const { data: generations } = await supabase
    .from("ai_generations")
    .select("id, image_role, output_image_url, status, variant_warna")
    .in("id", allIds);

  const notReady = generations?.find((g) => g.status !== "completed");
  if (notReady) {
    return NextResponse.json(
      { error: "Hanya gambar berstatus completed yang bisa dipublish" },
      { status: 400 }
    );
  }

  const byId = new Map(generations!.map((g) => [g.id, g]));

  const utama = byId.get(body.data.imageIds.utama)!;
  const detailUploads = await Promise.all(
    body.data.imageIds.detail.map((genId, i) =>
      uploadPublishedImage(byId.get(genId)!.output_image_url!, set.product_kode, `detail-${i + 1}` as const)
    )
  );
  const utamaUpload = await uploadPublishedImage(utama.output_image_url!, set.product_kode, "utama");

  const seriGens = body.data.imageIds.seri
    .map((genId) => byId.get(genId)!)
    .filter((g) => g.variant_warna); // baris seri lama tanpa variant_warna diabaikan, tidak bisa dipetakan ke warna

  const seriUploads = await Promise.all(
    seriGens.map(async (g) => {
      const upload = await uploadPublishedImage(
        g.output_image_url!,
        set.product_kode,
        `seri-${slugifyWarna(g.variant_warna!)}`
      );
      return { warna: g.variant_warna!, url: upload.secure_url };
    })
  );

  // Merge ke warna_images yang sudah ada di products (bukan overwrite total)
  // supaya publish satu-dua warna baru tidak menghapus warna lain yang sudah
  // pernah dipublish sebelumnya.
  let mergedWarnaImages: Record<string, { image: string }> | null = null;
  if (seriUploads.length > 0) {
    const { data: existingProduct } = await service
      .from("products")
      .select("warna_images")
      .eq("kode", set.product_kode)
      .single();
    const existing = (existingProduct?.warna_images as Record<string, { image: string }> | null) ?? {};
    mergedWarnaImages = { ...existing };
    for (const u of seriUploads) {
      mergedWarnaImages[u.warna] = { image: u.url };
    }
  }

  // NOTE: ini OVERWRITE data live products.image/detail (dan merge warna_images)
  // — sesuai PRD §15, admin harus sudah dapat konfirmasi eksplisit di UI
  // sebelum endpoint ini dipanggil (aturan "Explicit permission required"
  // utk data yg tampil publik).
  const { error: updateError } = await service
    .from("products")
    .update({
      image: utamaUpload.secure_url,
      detail: detailUploads.map((u) => u.secure_url),
      ...(mergedWarnaImages ? { warna_images: mergedWarnaImages } : {}),
    })
    .eq("kode", set.product_kode);

  if (updateError) {
    return NextResponse.json({ error: "Gagal update produk Deera" }, { status: 500 });
  }

  const publishedImageUrls = {
    image: utamaUpload.secure_url,
    detail: detailUploads.map((u) => u.secure_url),
    ...(seriUploads.length > 0
      ? { warna_images: Object.fromEntries(seriUploads.map((u) => [u.warna, u.url])) }
      : {}),
  };

  await supabase
    .from("ai_generation_sets")
    .update({ published_at: new Date().toISOString(), published_image_urls: publishedImageUrls })
    .eq("id", id);

  return NextResponse.json({ publishedAt: new Date().toISOString(), cloudinaryUrls: publishedImageUrls });
}
