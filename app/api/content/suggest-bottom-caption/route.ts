// POST /api/content/suggest-bottom-caption — Content Studio, panel "Poster
// AI". Regenerate KHUSUS kalimat bottomCaption (bar teks bawah poster),
// tanpa merombak headline/subtitle yang sudah di-review admin. Beda dari
// /suggest-headline yang generate SEMUA sekaligus.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestBottomCaption, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKode: z.string(),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo", "brand_awareness"]),
  extraNotes: z.string().optional(),
  headlineText: z.string().optional(),
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
    const bottomCaption = await suggestBottomCaption({
      product: {
        kode: product.kode,
        nama: product.nama,
        bahan: product.bahan,
        warna: product.warna as string[] | null,
      },
      theme: body.data.theme as ContentTheme,
      extraNotes: body.data.extraNotes,
      headlineText: body.data.headlineText,
    });

    return NextResponse.json({ bottomCaption });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate caption bar gagal" },
      { status: 500 }
    );
  }
}
