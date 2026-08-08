// POST /api/content/generate-caption — Content Studio.
// Generate SATU caption+hashtag (belum disimpan) berdasarkan fakta produk
// asli dari tabel products + tema yang dipilih admin. Dipanggil berulang
// kali dari halaman /content tiap admin klik "Generate Ulang" sebelum
// akhirnya disimpan sbg draft lewat POST /api/content-posts.
//
// Mendukung "mode grup" (2-5 produk sekaligus, lihat
// app/content/_hooks/useProductSelection.ts): kalau additionalProductKodes
// diisi, generateCaption() TIDAK menguraikan spesifikasi produk mana pun
// (lihat lib/prompts/content-generate.ts) — cukup fetch kode+nama produk
// tambahan, tanpa bahan/warna/harga.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCaption, type ContentTheme, type ContentType } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKode: z.string(),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo", "brand_awareness"]),
  contentType: z.enum(["feed_single", "carousel", "reel"]),
  extraNotes: z.string().optional(),
  additionalProductKodes: z.array(z.string()).max(4).optional(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("kode, nama, bahan, warna, variants")
    .eq("kode", body.data.productKode)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  let additionalProducts: { kode: string; nama: string }[] | undefined;
  if (body.data.additionalProductKodes?.length) {
    const { data: extras } = await supabase
      .from("products")
      .select("kode, nama")
      .in("kode", body.data.additionalProductKodes);
    additionalProducts = extras ?? [];
  }

  const variants = (product.variants as { size: string; harga: number }[] | null) ?? [];
  const hargaList = variants.map((v) => v.harga).filter((h): h is number => typeof h === "number");

  try {
    const result = await generateCaption({
      product: {
        kode: product.kode,
        nama: product.nama,
        bahan: product.bahan,
        warna: product.warna as string[] | null,
        ukuran: variants.map((v) => v.size),
        hargaMin: hargaList.length ? Math.min(...hargaList) : null,
        hargaMax: hargaList.length ? Math.max(...hargaList) : null,
      },
      theme: body.data.theme as ContentTheme,
      contentType: body.data.contentType as ContentType,
      extraNotes: body.data.extraNotes,
      additionalProducts,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate caption gagal" },
      { status: 500 }
    );
  }
}
