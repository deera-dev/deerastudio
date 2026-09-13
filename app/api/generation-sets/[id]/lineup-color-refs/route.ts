// PATCH /api/generation-sets/:id/lineup-color-refs — Agustus 2026, REVISI
// BESAR (lihat app/lineup-warna/page.tsx utk konteks lengkap).
//
// Admin: "disini kan baru tersedia kalau seri warnanya sudah terfoto/
// generate, nah saya gamau itu karena akan boros credit, harus generate per
// seri foto satu2, sedangkan saya punya foto asli flat ray originalnya...
// saya bisa hanya attach foto asli flat ray masing-masing warnanya, dan
// dijadikan 1 foto produk seri warna nya".
//
// Sebelumnya, warna tambahan utk fitur Lineup Warna HARUS berupa baris
// ai_generations role "seri" — yang keberadaannya mewajibkan generate 1
// foto model PENUH per warna lewat Nano Banana Pro (Rp2.700/warna, lihat
// app/api/generation-sets/[id]/add-seri/route.ts). Endpoint ini
// memperkenalkan sumber data BARU yang sepenuhnya independen: kolom jsonb
// ai_generation_sets.lineup_color_refs — array {warna, image}[] berisi
// foto flat-lay ASLI per warna, dikelola LANGSUNG dari halaman Lineup
// Warna, TIDAK PERNAH memicu generate AI apa pun. Baru saat admin klik
// "Generate Lineup Warna" barulah 1x panggilan AI terjadi (compose SEMUA
// warna jadi 1 scene), lihat app/api/generation-sets/[id]/color-lineup/
// route.ts.
//
// PATCH ini replace SELURUH array sekaligus (bukan add/remove terpisah) —
// client (lineup-warna/page.tsx) selalu kirim array lengkap yang
// diinginkan setelah tambah/ganti-foto/hapus 1 entri. Sederhana & aman utk
// tool internal admin (bukan multi-user concurrent editing).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/api-error";

const requestSchema = z.object({
  entries: z
    .array(
      z.object({
        warna: z.string().trim().min(1).max(60),
        image: z.string().url(),
      })
    )
    .max(8),
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

  // Nama warna harus unik dalam 1 set — dua entri warna yang sama akan
  // membingungkan caption lineup & referensi AI.
  const names = body.data.entries.map((e) => e.warna.toUpperCase());
  if (new Set(names).size !== names.length) {
    return NextResponse.json({ error: "Ada nama warna yang duplikat" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_generation_sets")
    .update({ lineup_color_refs: body.data.entries })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Gagal menyimpan daftar warna" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
