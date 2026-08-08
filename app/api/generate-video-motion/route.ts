// POST /api/generate-video-motion — SHARED route (bukan di bawah /content)
// karena dipakai DUA fitur: Content Studio (Reel) & "Generate Video (AI)"
// per foto di History/Generate. Lihat lib/prompts/video-motion.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { suggestVideoMotion } from "@/lib/prompts/video-motion";
import { VIDEO_DURATION_DEFAULT } from "@/lib/fal/video";

const requestSchema = z.object({
  productKode: z.string().optional(), // opsional — Generate/History mungkin tidak selalu tahu kode produk
  contextNote: z.string().optional(),
  durationSeconds: z.number().int().min(3).max(15).default(VIDEO_DURATION_DEFAULT),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  let product: { kode: string; nama: string; bahan: string | null } | null = null;
  if (body.data.productKode) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("kode, nama, bahan")
      .eq("kode", body.data.productKode)
      .single();
    product = data;
  }

  try {
    const result = await suggestVideoMotion({
      product: product ?? undefined,
      contextNote: body.data.contextNote,
      durationSeconds: body.data.durationSeconds,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Gagal menyarankan motion prompt" },
      { status: 500 }
    );
  }
}
