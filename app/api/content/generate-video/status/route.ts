// POST /api/content/generate-video/status — poll & RECONCILE progress
// video Content Studio. STATELESS (beda dari History yang persist ke
// ai_generation_sets) — client mengirim state clipJobs/mergeRequestId
// yang dia tahu terakhir, server memajukan sejauh yang sudah berubah di
// fal.ai, lalu kembalikan state terbaru APA ADANYA (client yang simpan
// balik ke state-nya sendiri). Logic reconcile-nya sama persis dgn
// History — lihat reconcileVideoJob() di lib/fal/video.ts, supaya kedua
// alur video selalu konsisten.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reconcileVideoJob } from "@/lib/fal/video";

const clipJobSchema = z.object({
  requestId: z.string(),
  sourceUrl: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  clipUrl: z.string().nullable(),
  errorMessage: z.string().nullable().optional(),
});

const requestSchema = z.object({
  clipJobs: z.array(clipJobSchema).min(1),
  mergeRequestId: z.string().nullable(),
});

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const result = await reconcileVideoJob(body.data.clipJobs, body.data.mergeRequestId);
  return NextResponse.json(result);
}
