// POST /api/content/generate-video — Content Studio, panel Video (khusus
// contentType "reel"). REVISI Agustus 2026 v2 (admin minta video digabung
// dari SEMUA foto post jadi 1 video utuh, bukan pilih 1 foto): terima
// ARRAY foto (urut sesuai cerita yang diinginkan admin), submit 1 klip
// Kling per foto, kembalikan semua request_id ke client. TIDAK ada baris
// DB yang ditulis di sini (beda dari History yang persist ke
// ai_generation_sets) — draft Content Studio belum tentu disimpan, jadi
// progress video disimpan di STATE CLIENT saja (lihat
// useVideoGeneration.ts) sampai admin klik "Simpan Draft", baru videoUrl
// akhir dilampirkan lewat POST /api/content-posts.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { submitVideoClipJob, VIDEO_DURATION_DEFAULT } from "@/lib/fal/video";
import { logAiCost } from "@/lib/cost-log";
import type { VideoClipJob } from "@/types/database";

// Kling 3.0 Pro $0.112/detik (audio off) — SAMA dgn konstanta di
// lib/fal/video.ts (COST_PER_SECOND_RP), versi USD krn ai_cost_log
// menyimpan cost_usd. Dicatat DI SINI (bukan di submitVideoClipJob yang
// dipakai bareng History) supaya TIDAK dobel-hitung dgn
// ai_generation_sets.video_cost milik History yang sudah dicatat sendiri
// di app/api/generation-sets/[id]/generate-video/route.ts.
const KLING_COST_PER_SECOND_USD = 0.112;

const requestSchema = z.object({
  sourceImageUrls: z.array(z.string().url()).min(1).max(10),
  prompt: z.string().min(1, "Motion prompt wajib diisi"),
  durationPerClipSeconds: z.number().int().min(3).max(15).default(VIDEO_DURATION_DEFAULT),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const clipJobs: VideoClipJob[] = await Promise.all(
      body.data.sourceImageUrls.map(async (sourceUrl): Promise<VideoClipJob> => {
        const { requestId } = await submitVideoClipJob({
          startImageUrl: sourceUrl,
          prompt: body.data.prompt,
          durationSeconds: body.data.durationPerClipSeconds,
        });
        void logAiCost({
          feature: "kling_video_clip",
          costUsd: KLING_COST_PER_SECOND_USD * body.data.durationPerClipSeconds,
          note: "Content Studio",
        });
        return { requestId, sourceUrl, status: "queued", clipUrl: null };
      })
    );
    return NextResponse.json({ clipJobs });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Generate video gagal" },
      { status: 500 }
    );
  }
}
