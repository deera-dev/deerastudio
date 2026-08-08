// POST /api/content/suggest-group-storyboard — Content Studio, mode grup
// (2-5 produk). Rancang N scene (sceneCount) di mana SEMUA produk/model
// tampil bersama di tiap frame, dipakai app/content/_hooks/useGroupCombo.ts
// buat mengisi textarea tiap scene sebelum digenerate lewat
// generate-combo-photo.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestGroupStoryboard, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKodes: z.array(z.string()).min(2).max(5),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo", "brand_awareness"]),
  extraNotes: z.string().optional(),
  sceneCount: z.number().int().min(1).max(6),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("kode, nama")
    .in("kode", body.data.productKodes);

  if (error || !products || products.length === 0) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  // Urutkan sesuai urutan productKodes yang dikirim (urutan pilih admin),
  // bukan urutan hasil query Supabase yang tidak terjamin.
  const ordered = body.data.productKodes
    .map((kode) => products.find((p) => p.kode === kode))
    .filter((p): p is { kode: string; nama: string } => Boolean(p));

  try {
    const result = await suggestGroupStoryboard({
      products: ordered,
      theme: body.data.theme as ContentTheme,
      extraNotes: body.data.extraNotes,
      sceneCount: body.data.sceneCount,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate alur cerita grup gagal" },
      { status: 500 }
    );
  }
}
