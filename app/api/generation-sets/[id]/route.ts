// GET /api/generation-sets/:id — PRD §15. Detail satu set + 5 gambar anaknya.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // sampel:sampel_id(...) — embed via FK sampel_id (lihat migrasi
  // ai_generation_sets_support_sampel) supaya set yang sumbernya sampel
  // (belum punya kode produk) tetap bisa ditampilkan label nomor/nama-nya
  // tanpa query terpisah di client. null kalau set ini produk katalog biasa.
  const { data: set, error } = await supabase
    .from("ai_generation_sets")
    .select("*, ai_generations(*), sampel:sampel_id(nomor, nama)")
    .eq("id", id)
    .single();

  if (error || !set) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(set);
}
