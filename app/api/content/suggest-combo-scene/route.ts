// POST /api/content/suggest-combo-scene — DEPRECATED, digantikan oleh
// /api/content/suggest-group-storyboard (lihat lib/prompts/content-generate.ts
// suggestGroupStoryboard()). File ini TIDAK dipakai UI mana pun lagi
// (app/content/page.tsx sudah pindah ke useGroupCombo + GroupComboPanel).
// Dibiarkan ada sbg thin-compat shim (bukan dihapus) karena beberapa
// environment tidak mengizinkan hapus file setelah ditulis — shim ini
// tetap type-safe & fungsional (delegasikan ke suggestGroupStoryboard dgn
// sceneCount=1) supaya TIDAK memecah build gara-gara referensi fungsi lama
// yang sudah dihapus dari content-generate.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestGroupStoryboard, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  productKodeA: z.string(),
  productKodeB: z.string(),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo", "brand_awareness"]),
  extraNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const [{ data: productA, error: errorA }, { data: productB, error: errorB }] = await Promise.all([
    supabase.from("products").select("kode, nama").eq("kode", body.data.productKodeA).single(),
    supabase.from("products").select("kode, nama").eq("kode", body.data.productKodeB).single(),
  ]);

  if (errorA || !productA || errorB || !productB) {
    return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
  }

  try {
    const result = await suggestGroupStoryboard({
      products: [
        { kode: productA.kode, nama: productA.nama },
        { kode: productB.kode, nama: productB.nama },
      ],
      theme: body.data.theme as ContentTheme,
      extraNotes: body.data.extraNotes,
      sceneCount: 1,
    });

    return NextResponse.json({ sceneIdea: result.scenes[0]?.sceneIdea ?? "" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sarankan ide gagal" },
      { status: 500 }
    );
  }
}
