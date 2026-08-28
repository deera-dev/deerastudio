// GET/POST /api/generate-bebas — "Generate Bebas" (Agustus 2026), lihat
// lib/prompts/freeform-generate.ts utk latar belakang lengkap. Halaman AI
// image generation bebas produk, admin bisa upload foto referensi opsional
// + tulis prompt bebas apa saja (spt ChatGPT/Gemini image gen) — TIDAK ada
// asumsi/instruksi fidelity produk Deera sama sekali di sini.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runFreeformGenerate } from "@/lib/prompts/freeform-generate";

// fal.subscribe sinkron — jatah waktu longgar, konsisten dgn route lain yg
// panggil Nano Banana Pro (lihat catatan BUG FIX maxDuration di
// app/api/generations/[id]/regenerate/route.ts).
export const maxDuration = 300;

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  referenceImageUrls: z.array(z.string().url()).max(6).optional(),
  // Subset sesuai ASPECT_OPTIONS di app/generate-bebas/page.tsx — harus
  // cocok dgn union FreeformAspectRatio di lib/prompts/freeform-generate.ts.
  aspectRatio: z.enum(["1:1", "3:4", "4:3", "9:16", "16:9"]).optional(),
});

// Estimasi Rp — sama seperti pemanggilan Nano Banana Pro lain di app ini
// (resolusi 2K, harga sama dgn 1K per konfirmasi sebelumnya).
const COST_FREEFORM = 2700;

const HISTORY_PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const page = Number(req.nextUrl.searchParams.get("page") ?? "0");
  const from = page * HISTORY_PAGE_SIZE;
  const { data, count } = await supabase
    .from("freeform_generations")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + HISTORY_PAGE_SIZE - 1);
  return NextResponse.json({ items: data ?? [], total: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: row, error: insertError } = await supabase
    .from("freeform_generations")
    .insert({
      prompt: body.data.prompt,
      reference_image_urls: body.data.referenceImageUrls ?? [],
      aspect_ratio: body.data.aspectRatio ?? "1:1",
      status: "processing",
      created_by_email: user?.email ?? null,
    })
    .select()
    .single();
  if (insertError || !row) {
    return NextResponse.json({ error: "Gagal menyimpan permintaan generate" }, { status: 500 });
  }

  try {
    const result = await runFreeformGenerate({
      prompt: body.data.prompt,
      referenceImageUrls: body.data.referenceImageUrls,
      aspectRatio: body.data.aspectRatio,
    });

    const { data: updated } = await supabase
      .from("freeform_generations")
      .update({
        output_image_url: result.imageUrl,
        status: "completed",
        generation_time_ms: result.generationTimeMs,
        cost: COST_FREEFORM,
      })
      .eq("id", row.id)
      .select()
      .single();

    return NextResponse.json(updated ?? row);
  } catch (err) {
    await supabase
      .from("freeform_generations")
      .update({ status: "failed", error_message: (err as Error).message })
      .eq("id", row.id);
    return NextResponse.json({ error: (err as Error).message || "Generate gagal" }, { status: 500 });
  }
}
