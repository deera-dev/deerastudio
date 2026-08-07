// POST /api/content/generate-marketing-photo — Content Studio, panel
// "Poster AI". Ambil 1 foto produk yang SUDAH ADA (model+garment, biasanya
// studio polos) dan restyle ULANG cuma background/mood/lighting-nya lewat
// Nano Banana Pro edit (lib/prompts/marketing-photo.ts) — model, wajah,
// pose, dan produk (warna/motif/tekstur) dikunci 100% identik. Hasil
// fal.ai di-fetch lalu di-upload ulang ke Supabase Storage (folder
// content-marketing-photos) supaya URL-nya permanen (URL fal.media bisa
// kedaluwarsa), bukan URL fal.media dipakai langsung.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateMarketingPhoto } from "@/lib/prompts/marketing-photo";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";

const requestSchema = z.object({
  sourceImageUrl: z.string().url(),
  sceneDescription: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateMarketingPhoto({
      sourceImageUrl: body.data.sourceImageUrl,
      sceneDescription: body.data.sceneDescription,
    });

    const fetched = await fetch(result.imageUrl);
    if (!fetched.ok) {
      throw new Error("Gagal mengambil hasil foto dari fal.ai");
    }
    const buffer = Buffer.from(await fetched.arrayBuffer());
    const url = await uploadBufferToStorage(buffer, "content-marketing-photos", "image/jpeg");

    return NextResponse.json({ url, generationTimeMs: result.generationTimeMs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate foto marketing gagal" },
      { status: 500 }
    );
  }
}
