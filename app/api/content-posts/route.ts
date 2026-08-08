// POST /api/content-posts — Content Studio.
// Simpan draft content post (hasil generate-caption yang sudah di-review/
// edit admin) ke tabel content_posts. Publish-nya lewat endpoint terpisah
// (POST /api/content-posts/:id/publish), supaya admin selalu review dulu
// sebelum apa pun tayang ke publik (aturan explicit-permission utk data
// publik, sama seperti alur publish AI Studio -> katalog).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  productKode: z.string(),
  imageUrls: z.array(z.string().url()).min(1).max(10),
  contentType: z.enum(["feed_single", "carousel", "reel"]),
  theme: z.enum(["produk_highlight", "tips_styling", "brand_story", "promo"]),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  extraNotes: z.string().optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  secondaryProductKodes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("content_posts")
    .insert({
      product_kode: body.data.productKode,
      secondary_product_kodes: body.data.secondaryProductKodes ?? [],
      image_urls: body.data.imageUrls,
      content_type: body.data.contentType,
      theme: body.data.theme,
      caption: body.data.caption,
      hashtags: body.data.hashtags,
      extra_notes: body.data.extraNotes ?? null,
      scheduled_at: body.data.scheduledAt ?? null,
      status: body.data.scheduledAt ? "scheduled" : "draft",
      created_by_email: user?.email ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Gagal simpan draft konten" }, { status: 500 });
  }

  return NextResponse.json(data);
}
