// PATCH /api/generation-sets/:id/lineup-color-order — Agustus 2026.
// Admin: "saya ingin bisa mengatur posisi warnanya, apakah bisa?" — urutan
// tampil warna kiri-ke-kanan di scene Lineup Warna (lihat app/lineup-warna/
// page.tsx, tombol panah di tiap tile referensi warna).
//
// Body: { order: string[] } — tiap elemen "__main__" (warna utama) atau
// nama warna yang match salah satu ai_generation_sets.lineup_color_refs[].
// warna. Divalidasi ringan di sini (harus subset dari key yang benar-benar
// ada) supaya tidak ada key sampah tersimpan — key yang HILANG dari body
// (mis. admin reorder tepat sebelum entri lain dihapus/ditambah) otomatis
// di-append di akhir saat generate lewat orderColorReferences() (lihat
// lib/prompts/color-lineup-generate.ts), jadi PATCH ini tidak perlu selalu
// lengkap 100%.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/api-error";

const requestSchema = z.object({
  order: z.array(z.string().min(1)).max(8),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: zodErrorMessage(body.error) }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: setRaw, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("id, lineup_color_refs")
    .eq("id", id)
    .single();
  if (setError || !setRaw) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  const validKeys = new Set([
    "__main__",
    ...((setRaw.lineup_color_refs ?? []) as { warna: string }[]).map((r) => r.warna),
  ]);
  const sanitizedOrder = body.data.order.filter((k) => validKeys.has(k));

  const { error: updateError } = await supabase
    .from("ai_generation_sets")
    .update({ lineup_color_order: sanitizedOrder })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Gagal menyimpan urutan warna" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
