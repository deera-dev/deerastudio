// POST /api/admin/backfill-thumbs — Oktober 2026, sekali jalan (idempotent).
// Foto hasil generate LAMA masih berupa URL fal.ai (PNG 2K, berat) tanpa
// thumbnail. Endpoint ini memproses baris yg output_thumb_url-nya masih
// kosong: unduh gambar, salin PNG penuh ke Supabase Storage, buat thumbnail
// JPEG, lalu update baris. Dipanggil berulang (batch kecil per request, biar
// tidak kena batas waktu) sampai respons `remaining` = 0.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mirrorOutputImage } from "@/lib/images/mirror-output";
import { errorMessage } from "@/lib/api-error";

export const maxDuration = 300;

const BATCH = 8;
// Hanya gambar yg masih di CDN fal.ai yg perlu disalin; yg sudah di storage
// kita (kolase/lineup) cukup dibuatkan thumbnail-nya.
type Row = { id: string; output_image_url: string };

async function processTable(table: "ai_generations" | "freeform_generations", limit: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from(table)
    .select("id, output_image_url")
    .is("output_thumb_url", null)
    .not("output_image_url", "is", null)
    .eq("status", "completed")
    .limit(limit);
  const rows = (data ?? []) as Row[];
  let done = 0;
  const errors: string[] = [];
  for (const row of rows) {
    try {
      const m = await mirrorOutputImage(row.output_image_url, "generated");
      if (!m.thumbUrl) throw new Error("thumbnail gagal dibuat");
      const { error } = await supabase
        .from(table)
        .update({ output_image_url: m.fullUrl, output_thumb_url: m.thumbUrl })
        .eq("id", row.id);
      if (error) throw error;
      done++;
    } catch (err) {
      errors.push(`${table}/${row.id}: ${errorMessage(err)}`);
      // tandai supaya tidak diulang terus-menerus kalau URL sumber sudah mati
      await supabase.from(table).update({ output_thumb_url: row.output_image_url }).eq("id", row.id);
    }
  }
  return { done, errors };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Belum login" }, { status: 401 });

  const a = await processTable("ai_generations", BATCH);
  const b = await processTable("freeform_generations", Math.max(0, BATCH - a.done));

  const count = async (table: string) => {
    const { count: c } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .is("output_thumb_url", null)
      .not("output_image_url", "is", null)
      .eq("status", "completed");
    return c ?? 0;
  };
  const remaining = (await count("ai_generations")) + (await count("freeform_generations"));

  return NextResponse.json({
    processed: a.done + b.done,
    remaining,
    errors: [...a.errors, ...b.errors],
  });
}
