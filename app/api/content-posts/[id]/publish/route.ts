// POST /api/content-posts/:id/publish — publish 1 content post ke Instagram
// (lib/instagram/client.ts). Kalau INSTAGRAM_ACCESS_TOKEN/
// INSTAGRAM_BUSINESS_ACCOUNT_ID belum di-set (Meta App Review belum selesai
// — lihat README §Instagram), endpoint ini menolak dgn pesan jelas TANPA
// mengubah status post (tetap draft/scheduled, aman dicoba lagi nanti).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isInstagramConfigured,
  publishCarousel,
  publishFeedSingle,
  publishReel,
} from "@/lib/instagram/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isInstagramConfigured()) {
    return NextResponse.json(
      {
        error:
          "Instagram belum terhubung. Butuh INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_BUSINESS_ACCOUNT_ID di .env, dan itu baru bisa didapat setelah Meta App Review disetujui — lihat README §Instagram. Sementara ini caption/foto bisa disalin manual.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("content_posts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: "Konten tidak ditemukan" }, { status: 404 });
  }
  if (post.status === "published") {
    return NextResponse.json({ error: "Konten ini sudah published" }, { status: 400 });
  }

  const captionWithHashtags = [
    post.caption,
    (post.hashtags as string[] | null)?.length ? (post.hashtags as string[]).join(" ") : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const imageUrls = (post.image_urls as string[] | null) ?? [];

  try {
    let mediaId: string;

    if (post.content_type === "carousel") {
      const result = await publishCarousel({ imageUrls, caption: captionWithHashtags });
      mediaId = result.mediaId;
    } else if (post.content_type === "reel") {
      const videoUrl = imageUrls[0];
      if (!videoUrl) throw new Error("Reel butuh URL video di image_urls[0]");
      const result = await publishReel({ videoUrl, caption: captionWithHashtags });
      mediaId = result.mediaId;
    } else {
      const imageUrl = imageUrls[0];
      if (!imageUrl) throw new Error("Konten ini tidak punya foto");
      const result = await publishFeedSingle({ imageUrl, caption: captionWithHashtags });
      mediaId = result.mediaId;
    }

    await supabase
      .from("content_posts")
      .update({
        status: "published",
        instagram_media_id: mediaId,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", id);

    return NextResponse.json({ status: "published", mediaId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish gagal";
    await supabase
      .from("content_posts")
      .update({ status: "failed", error_message: message })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
