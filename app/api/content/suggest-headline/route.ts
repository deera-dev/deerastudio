// POST /api/content/suggest-headline — Content Studio, panel "Poster AI".
// Sarankan headline/subtitle/bottomCaption (copywriting mood, lihat
// lib/prompts/content-generate.ts) berdasarkan fakta produk asli. Kode
// produk & warna tersedia TIDAK diminta dari AI — diisi langsung dari
// tabel products di sini supaya selalu akurat (bukan hasil generate LLM).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestHeadline, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKode: z.string(),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo"]),
  extraNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("kode, nama, bahan, warna")
    .eq("kode", body.data.productKode)
    .single();

  if (error || !product) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  try {
    const result = await suggestHeadline({
      product: {
        kode: product.kode,
        nama: product.nama,
        bahan: product.bahan,
        warna: product.warna as string[] | null,
      },
      theme: body.data.theme as ContentTheme,
      extraNotes: body.data.extraNotes,
    });

    return NextResponse.json({
      ...result,
      productCode: product.kode,
      colors: ((product.warna as string[] | null) ?? []).slice(0, 6),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Saran headline gagal" },
      { status: 500 }
    );
  }
}
