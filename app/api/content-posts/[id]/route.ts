// PATCH /api/content-posts/:id — edit draft (caption/hashtag/jadwal) sebelum
// publish. DELETE /api/content-posts/:id — hapus draft yang belum publish
// (tidak boleh hapus yang statusnya "published", biar histori tetap utuh).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  caption: z.string().min(1).optional(),
  hashtags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  imageUrls: z.array(z.string().url()).min(1).max(10).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("content_posts")
    .select("status")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Konten tidak ditemukan" }, { status: 404 });
  }
  if (existing.status === "published") {
    return NextResponse.json({ error: "Konten yang sudah published tidak bisa diedit" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.caption !== undefined) update.caption = body.data.caption;
  if (body.data.hashtags !== undefined) update.hashtags = body.data.hashtags;
  if (body.data.imageUrls !== undefined) update.image_urls = body.data.imageUrls;
  if (body.data.scheduledAt !== undefined) {
    update.scheduled_at = body.data.scheduledAt;
    update.status = body.data.scheduledAt ? "scheduled" : "draft";
  }

  const { data, error } = await supabase
    .from("content_posts")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Gagal update konten" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("content_posts")
    .select("status")
    .eq("id", id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Konten tidak ditemukan" }, { status: 404 });
  }
  if (existing.status === "published") {
    return NextResponse.json({ error: "Konten yang sudah published tidak bisa dihapus" }, { status: 400 });
  }

  const { error } = await supabase.from("content_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Gagal hapus konten" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
