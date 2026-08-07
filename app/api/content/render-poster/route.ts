// POST /api/content/render-poster — Content Studio, panel "Poster AI".
// Render 1 foto produk + headline/subtitle/kode/swatch warna/caption bar
// jadi 1 poster PNG siap posting (lib/image-template/poster.tsx, next/og
// ImageResponse), lalu upload ke Supabase Storage (bucket ai-fashion-studio,
// lihat lib/supabase/storage-server.ts) dan kembalikan URL publiknya.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { renderPosterPng } from "@/lib/image-template/poster";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";

const requestSchema = z.object({
  photoUrl: z.string().url(),
  headline: z
    .array(z.object({ text: z.string().min(1), script: z.boolean().optional() }))
    .min(1)
    .max(3),
  subtitle: z.string().optional(),
  productCode: z.string().optional(),
  colors: z.array(z.string()).optional(),
  bottomCaption: z.string().optional(),
  showProductCode: z.boolean().optional(),
  showColors: z.boolean().optional(),
  showBottomCaption: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }
  const d = body.data;

  try {
    const buffer = await renderPosterPng({
      photoUrl: d.photoUrl,
      headline: d.headline,
      subtitle: d.subtitle,
      productCode: d.showProductCode === false ? undefined : d.productCode,
      colors: d.showColors === false ? undefined : d.colors?.map((warna) => ({ warna })),
      bottomCaption: d.showBottomCaption === false ? undefined : d.bottomCaption,
    });

    const url = await uploadBufferToStorage(buffer, "content-posters", "image/png");
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render poster gagal" },
      { status: 500 }
    );
  }
}
