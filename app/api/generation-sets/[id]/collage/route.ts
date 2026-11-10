// POST /api/generation-sets/:id/collage — "Kolase 2 Foto" (November 2026,
// admin: "saya mau nambah fitur collase atau foto grid dimana bisa bikin 2
// foto bergabung jadi 1, rencananya seperti menggabungkan foto tampak
// depan dan tampak belakang buat di share ke langganan, atau foto tampak
// depan dengan foto seri warna lengkap"). Lihat app/history/page.tsx
// ("+ Kolase 2 Foto") utk UI picker-nya.
//
// BEDA dari kolase_gabungan/kolase_warna: admin BEBAS pilih 2 URL foto apa
// saja dari riwayat produk ini (termasuk kolase_warna/"Lineup Warna" —
// itulah tepatnya use-case "foto tampak depan + seri warna" yang diminta),
// bukan panggilan AI (compositing next/og murni, lihat
// lib/image-template/photo-collage.tsx), `cost` selalu 0.
//
// TIDAK idempotent/singleton per set (beda dari color-lineup/route.ts) —
// tiap panggilan SELALU bikin baris ai_generations baru, karena admin bisa
// saja mau bikin beberapa kolase dgn pasangan foto berbeda-beda utk produk
// yang sama (pola yang sama spt role "seri", boleh banyak baris per set).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { renderPhotoCollagePng } from "@/lib/image-template/photo-collage";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import { makeThumbnailUrl } from "@/lib/images/mirror-output";
import { errorMessage, zodErrorMessage } from "@/lib/api-error";

const requestSchema = z.object({
  leftUrl: z.string().url(),
  rightUrl: z.string().url(),
  kode: z.string().trim().min(1).optional(),
  size: z.string().trim().min(1).optional(),
  showInfo: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: zodErrorMessage(body.error) }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: set, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("id")
    .eq("id", id)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }

  try {
    const buffer = await renderPhotoCollagePng({
      leftUrl: body.data.leftUrl,
      rightUrl: body.data.rightUrl,
      kode: body.data.kode,
      size: body.data.size,
      showInfo: body.data.showInfo,
    });
    const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");
    const thumbUrl = await makeThumbnailUrl(buffer, "generated-collages");

    const { data: created, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        generation_set_id: id,
        image_role: "kolase_pilihan",
        pose_id: null,
        variant_warna: null,
        variant_product_images: null,
        vto_image_url: null,
        output_image_url: url,
        output_thumb_url: thumbUrl,
        has_stage2: true,
        status: "completed",
        generation_time_ms: 0,
        cost: 0,
      })
      .select()
      .single();
    if (insertError || !created) {
      return NextResponse.json({ error: "Gagal menyimpan hasil kolase" }, { status: 500 });
    }

    return NextResponse.json({ generationId: created.id, imageUrl: url });
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err, "Gagal membuat kolase") },
      { status: 500 }
    );
  }
}
