// Wrapper video generation (Agustus 2026, REVISI v2 — "video cerita
// gabungan") — dipakai Content Studio (Reel) & History/Generate. Alur:
// 1. Tiap foto yang dipilih admin dianimasikan jadi 1 klip pendek via
//    Kling 3.0 Pro image-to-video (submitVideoClipJob/checkVideoClipJob).
// 2. SEMUA klip yang sudah selesai digabung URUT jadi SATU video utuh via
//    fal-ai/ffmpeg-api/merge-videos (submitMergeJob/checkMergeJob) —
//    lihat catatan di lib/fal/client.ts kenapa bukan ffmpeg lokal.
//
// REVISI v2 (menggantikan v1 generateVideoFromImage yang blocking/1-foto):
// admin sempat melaporkan dua masalah v1: (a) generate cuma spinner, tidak
// ada progress/status jelas, dan (b) kalau pindah halaman saat generate,
// tidak ada cara tahu hasilnya selesai/gagal. REVISI v2 pakai fal.queue
// (submit cepat + polling status terpisah) BUKAN fal.subscribe (blocking)
// supaya progress asli (IN_QUEUE/IN_PROGRESS/logs) bisa ditampilkan, dan
// supaya request_id-nya bisa disimpan (DB utk History, state client utk
// Content Studio) agar polling bisa DILANJUTKAN kapan saja — termasuk
// setelah admin pindah halaman lalu balik lagi.
//
// CATATAN DURASI: user minta klip 15-20 detik, tapi API Kling 3.0 Pro
// (`duration`) cuma terima enum "3"-"15" (string, per detik) — HARD CAP
// 15 detik per KLIP. Total durasi video gabungan = jumlah durasi semua
// klip (mis. 3 foto x 5 detik = video akhir 15 detik).
import { fal, FAL_MODELS } from "./client";
import type { KlingVideoV3ProImageToVideoInput } from "@fal-ai/client/endpoints";
import type { VideoClipJob } from "@/types/database";

export const VIDEO_DURATION_MIN = 3;
export const VIDEO_DURATION_MAX = 15;
// Default per-klip — dipakai Content Studio & History/Generate.
export const VIDEO_DURATION_DEFAULT = 5;

// Estimasi Rp (kurs ~Rp17.900/USD, Agustus 2026, sama seperti
// app/api/generate-set/route.ts): Kling 3.0 Pro $0.112/detik, audio off
// tidak mengubah harga per dokumentasi fal.ai. Biaya merge-videos relatif
// kecil (operasi ffmpeg murni, bukan model AI) — diabaikan dari estimasi.
const COST_PER_SECOND_RP = Math.round(0.112 * 17_900); // ~Rp2.005/detik

export function estimateVideoCostRp(totalDurationSeconds: number): number {
  return Math.round(COST_PER_SECOND_RP * totalDurationSeconds);
}

function clampDuration(seconds: number | undefined): number {
  const v = Math.round(seconds ?? VIDEO_DURATION_DEFAULT);
  return Math.min(VIDEO_DURATION_MAX, Math.max(VIDEO_DURATION_MIN, v));
}

// --- Klip individual (1 foto -> 1 klip pendek) ---

export interface SubmitVideoClipInput {
  startImageUrl: string;
  prompt: string;
  durationSeconds?: number; // di-clamp ke 3-15
  negativePrompt?: string;
}

export async function submitVideoClipJob(input: SubmitVideoClipInput): Promise<{ requestId: string }> {
  const duration = clampDuration(input.durationSeconds);
  const klingInput: KlingVideoV3ProImageToVideoInput = {
    prompt: input.prompt,
    start_image_url: input.startImageUrl,
    duration: String(duration) as KlingVideoV3ProImageToVideoInput["duration"],
    // User eksplisit minta "tanpa audio" — override default API (true).
    generate_audio: false,
    negative_prompt: input.negativePrompt,
  };
  const status = await fal.queue.submit(FAL_MODELS.KLING_VIDEO_PRO, { input: klingInput });
  return { requestId: status.request_id };
}

export type JobStatus =
  | { state: "IN_QUEUE"; queuePosition: number }
  | { state: "IN_PROGRESS"; logs: string[] }
  | { state: "COMPLETED"; videoUrl: string; fileSize: number | null }
  | { state: "FAILED"; errorMessage: string };

export async function checkVideoClipJob(requestId: string): Promise<JobStatus> {
  const status = await fal.queue.status(FAL_MODELS.KLING_VIDEO_PRO, { requestId, logs: true });
  if (status.status === "IN_QUEUE") {
    return { state: "IN_QUEUE", queuePosition: status.queue_position };
  }
  if (status.status === "IN_PROGRESS") {
    return { state: "IN_PROGRESS", logs: status.logs.map((l) => l.message) };
  }
  try {
    const result = await fal.queue.result(FAL_MODELS.KLING_VIDEO_PRO, { requestId });
    const data = result.data as { video?: { url: string; file_size?: number } };
    if (!data?.video?.url) {
      return { state: "FAILED", errorMessage: "Video tidak dihasilkan (respons kosong dari fal.ai)" };
    }
    return { state: "COMPLETED", videoUrl: data.video.url, fileSize: data.video.file_size ?? null };
  } catch (err) {
    return { state: "FAILED", errorMessage: (err as Error).message || "Generate klip video gagal" };
  }
}

// --- Gabung semua klip jadi 1 video utuh ---

export async function submitMergeJob(videoUrlsInOrder: string[]): Promise<{ requestId: string }> {
  const status = await fal.queue.submit(FAL_MODELS.FFMPEG_MERGE_VIDEOS, {
    input: { video_urls: videoUrlsInOrder },
  });
  return { requestId: status.request_id };
}

export async function checkMergeJob(requestId: string): Promise<JobStatus> {
  const status = await fal.queue.status(FAL_MODELS.FFMPEG_MERGE_VIDEOS, { requestId, logs: true });
  if (status.status === "IN_QUEUE") {
    return { state: "IN_QUEUE", queuePosition: status.queue_position };
  }
  if (status.status === "IN_PROGRESS") {
    return { state: "IN_PROGRESS", logs: status.logs.map((l) => l.message) };
  }
  try {
    const result = await fal.queue.result(FAL_MODELS.FFMPEG_MERGE_VIDEOS, { requestId });
    const data = result.data as { video?: { url: string; file_size?: number } };
    if (!data?.video?.url) {
      return { state: "FAILED", errorMessage: "Video gabungan tidak dihasilkan (respons kosong dari fal.ai)" };
    }
    return { state: "COMPLETED", videoUrl: data.video.url, fileSize: data.video.file_size ?? null };
  } catch (err) {
    return { state: "FAILED", errorMessage: (err as Error).message || "Gabung video gagal" };
  }
}


// --- Reconciliation bersama (dipakai History DB-backed & Content Studio
// stateless) ---
//
// Satu fungsi ini jadi SATU-SATUNYA tempat logic "majukan progress video
// cerita gabungan" hidup — dipanggil dari DUA tempat: History
// (app/api/generation-sets/[id]/generate-video/status/route.ts, hasil
// disimpan ke DB) & Content Studio (app/api/content/generate-video/status/
// route.ts, hasil dikembalikan ke client apa adanya, TIDAK ada DB row utk
// draft yang belum disimpan). Idempotent & aman dipanggil berkali-kali —
// cuma memajukan state sejauh yang sudah berubah di fal.ai.
export interface ReconcileVideoJobResult {
  videoStatus: "processing" | "completed" | "failed";
  videoUrl: string | null;
  errorMessage: string | null;
  clipJobs: VideoClipJob[];
  mergeRequestId: string | null;
  stage: "clips" | "merging" | null;
}

export async function reconcileVideoJob(
  clipJobsIn: VideoClipJob[],
  mergeRequestId: string | null
): Promise<ReconcileVideoJobResult> {
  // Tahap merge sudah disubmit — cek status job merge-nya.
  if (mergeRequestId) {
    const mergeStatus = await checkMergeJob(mergeRequestId);
    if (mergeStatus.state === "COMPLETED") {
      return {
        videoStatus: "completed",
        videoUrl: mergeStatus.videoUrl,
        errorMessage: null,
        clipJobs: clipJobsIn,
        mergeRequestId,
        stage: null,
      };
    }
    if (mergeStatus.state === "FAILED") {
      return {
        videoStatus: "failed",
        videoUrl: null,
        errorMessage: mergeStatus.errorMessage,
        clipJobs: clipJobsIn,
        mergeRequestId,
        stage: null,
      };
    }
    return {
      videoStatus: "processing",
      videoUrl: null,
      errorMessage: null,
      clipJobs: clipJobsIn,
      mergeRequestId,
      stage: "merging",
    };
  }

  // Tahap klip individual — cek tiap klip yang belum final.
  const clipJobs = await Promise.all(
    clipJobsIn.map(async (job): Promise<VideoClipJob> => {
      if (job.status === "completed" || job.status === "failed") return job;
      const jobStatus = await checkVideoClipJob(job.requestId);
      if (jobStatus.state === "IN_QUEUE") return { ...job, status: "queued" };
      if (jobStatus.state === "IN_PROGRESS") return { ...job, status: "processing" };
      if (jobStatus.state === "COMPLETED") {
        return { ...job, status: "completed", clipUrl: jobStatus.videoUrl };
      }
      return { ...job, status: "failed", errorMessage: jobStatus.errorMessage };
    })
  );

  const failedJob = clipJobs.find((j) => j.status === "failed");
  if (failedJob) {
    return {
      videoStatus: "failed",
      videoUrl: null,
      errorMessage: `Salah satu klip gagal digenerate: ${failedJob.errorMessage ?? "penyebab tidak diketahui"}`,
      clipJobs,
      mergeRequestId: null,
      stage: null,
    };
  }

  const allCompleted = clipJobs.every((j) => j.status === "completed");
  if (allCompleted) {
    try {
      const clipUrls = clipJobs.map((j) => j.clipUrl as string);
      const { requestId } = await submitMergeJob(clipUrls);
      return {
        videoStatus: "processing",
        videoUrl: null,
        errorMessage: null,
        clipJobs,
        mergeRequestId: requestId,
        stage: "merging",
      };
    } catch (err) {
      return {
        videoStatus: "failed",
        videoUrl: null,
        errorMessage: (err as Error).message || "Gagal submit job gabung video",
        clipJobs,
        mergeRequestId: null,
        stage: null,
      };
    }
  }

  return {
    videoStatus: "processing",
    videoUrl: null,
    errorMessage: null,
    clipJobs,
    mergeRequestId: null,
    stage: "clips",
  };
}
