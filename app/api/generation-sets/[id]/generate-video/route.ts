// POST /api/generation-sets/:id/generate-video — "Video Cerita Gabungan"
// (Agustus 2026, REVISI v2). BEDA dari versi lama (per-baris
// ai_generations, sekarang DEPRECATED — lihat
// app/api/generations/[id]/generate-video/route.ts): admin melaporkan mau
// video yang menggabung SEMUA foto post jadi SATU video utuh, bukan pilih
// 1 foto. Jadi endpoint ini level SET, terima ARRAY foto (urut sesuai
// urutan cerita yang diinginkan admin), submit 1 klip Kling per foto,
// simpan semua request_id ke video_clip_jobs supaya progress bisa
// dipantau & dilanjutkan kapan saja lewat route status/ di sebelah ini.
//
// REVISI v3 — admin kasih referensi video lookbook nyata (model
// turntable badan penuh + close-up manset/kerah/kancing/tekstur) dan
// minta hasil kombinasi kita "memperlihatkan segala detail dari segala
// angle" spt itu. Sebelumnya SATU `prompt` yang sama dipakai literal ke
// SEMUA klip — instruksi generik jadi kurang pas dipakai apa adanya baik
// utk foto badan penuh maupun close-up sekaligus. Sekarang: prompt per
// klip DITENTUKAN OTOMATIS dari image_role foto sumbernya masing-masing
// (lookup ke ai_generations milik set ini) lewat buildRoleMotionPrompt()
// — badan penuh (utama/angle/seri) dapat instruksi "model berputar
// anggun", close-up (detail) dapat instruksi "kamera pan/zoom menelusuri
// tekstur". `prompt` dari body sekarang OPSIONAL — kalau diisi, ditempel
// sbg catatan gaya/mood tambahan di akhir tiap prompt (lihat
// lib/prompts/video-motion.ts), bukan lagi satu-satunya instruksi.
//
// Cuma SUBMIT (tidak nunggu selesai) — respons cepat, biar UI bisa mulai
// polling status segera. Lihat lib/fal/video.ts utk alasan pakai
// fal.queue (bukan fal.subscribe blocking) & app/history/page.tsx utk UI
// progress-nya.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { submitVideoClipJob, estimateVideoCostRp, VIDEO_DURATION_DEFAULT } from "@/lib/fal/video";
import { buildRoleMotionPrompt } from "@/lib/prompts/video-motion";
import type { ImageRole, VideoClipJob } from "@/types/database";

const requestSchema = z.object({
  // Urut sesuai urutan cerita yang diinginkan admin — video_urls dikirim
  // ke fal-ai/ffmpeg-api/merge-videos PERSIS urutan ini nantinya.
  sourceImageUrls: z.array(z.string().url()).min(1).max(10),
  // Sekarang OPSIONAL (REVISI v3) — arah gerakan utama sudah otomatis per
  // role foto (lihat buildRoleMotionPrompt), ini cuma catatan gaya/mood
  // tambahan (mis. "warm golden hour lighting").
  prompt: z.string().optional(),
  durationPerClipSeconds: z.number().int().min(3).max(15).default(VIDEO_DURATION_DEFAULT),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: set, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("id")
    .eq("id", id)
    .single();
  if (setError || !set) {
    return NextResponse.json({ error: "Set foto tidak ditemukan" }, { status: 404 });
  }

  try {
    // Lookup image_role tiap foto sumber (badan-penuh vs close-up) supaya
    // prompt gerakan per klip bisa disesuaikan otomatis — lihat catatan
    // REVISI v3 di atas & lib/prompts/video-motion.ts.
    const { data: generationsRaw } = await supabase
      .from("ai_generations")
      .select("output_image_url, image_role")
      .eq("generation_set_id", id);
    const roleByUrl = new Map(
      (generationsRaw ?? [])
        .filter((g) => g.output_image_url)
        .map((g) => [g.output_image_url as string, g.image_role as ImageRole])
    );

    const clipJobs: VideoClipJob[] = await Promise.all(
      body.data.sourceImageUrls.map(async (sourceUrl): Promise<VideoClipJob> => {
        const role = roleByUrl.get(sourceUrl) ?? "utama"; // fallback aman kalau url tidak ketemu (seharusnya tidak terjadi)
        const { requestId } = await submitVideoClipJob({
          startImageUrl: sourceUrl,
          prompt: buildRoleMotionPrompt(role, body.data.prompt),
          durationSeconds: body.data.durationPerClipSeconds,
        });
        return { requestId, sourceUrl, status: "queued", clipUrl: null };
      })
    );

    const totalDuration = body.data.sourceImageUrls.length * body.data.durationPerClipSeconds;

    await supabase
      .from("ai_generation_sets")
      .update({
        video_status: "processing",
        video_url: null,
        video_error_message: null,
        video_started_at: new Date().toISOString(),
        video_clip_jobs: clipJobs,
        video_merge_request_id: null,
        video_cost: estimateVideoCostRp(totalDuration),
      })
      .eq("id", id);

    return NextResponse.json({ status: "processing", clipCount: clipJobs.length });
  } catch (err) {
    await supabase
      .from("ai_generation_sets")
      .update({
        video_status: "failed",
        video_error_message: (err as Error).message || "Gagal submit job video",
      })
      .eq("id", id);
    return NextResponse.json(
      { error: (err as Error).message || "Gagal submit job video" },
      { status: 500 }
    );
  }
}
