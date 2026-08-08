// POST /api/content/suggest-storyboard — Content Studio, panel "Foto
// Marketing AI" (per-slide). Beda dari /suggest-headline (1 sceneIdea buat
// background poster): ini menyarankan BEBERAPA sceneIdea SEKALIGUS yang
// saling terhubung sebagai satu alur cerita, satu per slide carousel yang
// sedang dipilih admin (lihat suggestStoryboard di
// lib/prompts/content-generate.ts untuk alasan lengkap).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestStoryboard, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKode: z.string(),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo", "brand_awareness"]),
  extraNotes: z.string().optional(),
  sceneCount: z.number().int().min(2).max(10),
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
    const result = await suggestStoryboard({
      product: {
        kode: product.kode,
        nama: product.nama,
        bahan: product.bahan,
        warna: product.warna as string[] | null,
      },
      theme: body.data.theme as ContentTheme,
      extraNotes: body.data.extraNotes,
      sceneCount: body.data.sceneCount,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate alur cerita gagal" },
      { status: 500 }
    );
  }
}
