// GET /api/generation-sets/:id/generate-video/status — poll & RECONCILE
// progress "Video Cerita Gabungan" (lihat route.ts di folder induk utk
// alur submit). Aman dipanggil berkali-kali (idempotent) — setiap panggil
// cuma memajukan state sejauh yang sudah berubah di fal.ai, lalu
// menyimpan progresnya ke DB. Karena semua state (video_clip_jobs,
// video_merge_request_id, video_status) disimpan di DB (bukan memory
// server), admin boleh pindah halaman/reload/buka set lain kapan saja —
// begitu buka set ini lagi & panggil status/ lagi, progress lanjut dari
// titik terakhir, TIDAK hilang.
//
// Logic reconcile-nya (submit merge begitu semua klip selesai, dst) ada
// di reconcileVideoJob() (lib/fal/video.ts) — SATU-SATUNYA sumber
// kebenaran, dipakai juga oleh Content Studio (versi stateless, tanpa DB,
// lihat app/api/content/generate-video/status/route.ts) supaya kedua
// alur video (History & Content Studio) selalu berperilaku identik.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reconcileVideoJob } from "@/lib/fal/video";
import type { VideoClipJob } from "@/types/database";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: set, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("video_status, video_url, video_error_message, video_clip_jobs, video_merge_request_id")
    .eq("id", id)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Set foto tidak ditemukan" }, { status: 404 });
  }

  // Sudah final (completed/failed) atau belum pernah diminta — tinggal
  // kembalikan state tersimpan apa adanya, tidak perlu panggil fal.ai lagi.
  if (set.video_status !== "processing") {
    return NextResponse.json({
      videoStatus: set.video_status,
      videoUrl: set.video_url,
      errorMessage: set.video_error_message,
      clipJobs: set.video_clip_jobs as VideoClipJob[],
    });
  }

  const result = await reconcileVideoJob(
    (set.video_clip_jobs as VideoClipJob[]) ?? [],
    set.video_merge_request_id
  );

  await supabase
    .from("ai_generation_sets")
    .update({
      video_status: result.videoStatus,
      video_url: result.videoUrl,
      video_error_message: result.errorMessage,
      video_clip_jobs: result.clipJobs,
      video_merge_request_id: result.mergeRequestId,
    })
    .eq("id", id);

  return NextResponse.json(result);
}
