// POST /api/content/generate-combo-photo — Content Studio, "Foto Gabungan
// Produk AI". Gabungkan 2-5 foto produk yang SUDAH ADA (masing-masing 1
// model+garment) jadi SATU frame baru lewat Nano Banana Pro edit
// (lib/prompts/combo-photo.ts). Hasil fal.ai di-fetch lalu diupload ulang ke
// Supabase Storage supaya URL-nya permanen, sama seperti
// generate-marketing-photo/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateComboPhoto } from "@/lib/prompts/combo-photo";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";

const requestSchema = z.object({
  sourceImageUrls: z.array(z.string().url()).min(2).max(5),
  sceneDescription: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateComboPhoto({
      sourceImageUrls: body.data.sourceImageUrls,
      sceneDescription: body.data.sceneDescription,
    });

    const fetched = await fetch(result.imageUrl);
    if (!fetched.ok) {
      throw new Error("Gagal mengambil hasil foto dari fal.ai");
    }
    const buffer = Buffer.from(await fetched.arrayBuffer());
    const url = await uploadBufferToStorage(buffer, "content-combo-photos", "image/jpeg");

    return NextResponse.json({ url, generationTimeMs: result.generationTimeMs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generate foto gabungan gagal" },
      { status: 500 }
    );
  }
}
