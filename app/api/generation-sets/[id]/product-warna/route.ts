// PATCH /api/generation-sets/:id/product-warna — Oktober 2026.
// Admin (lihat app/lineup-warna/page.tsx): set yang dibuat lewat endpoint
// ensure/route.ts (produk yang belum pernah diproses AI Fashion Studio)
// selalu punya product_warna NULL — tile foto utamanya jatuh ke fallback
// "Utama" di caption hasil Lineup Warna, padahal admin mau nama warna
// ASLINYA yang tampil. Endpoint ini kasih jalan admin isi/ubah nama warna
// foto utama langsung dari halaman Lineup Warna, terpisah dari upload foto
// (lihat color-reference/route.ts) — foto utama kadang mewakili warna yang
// bahkan tidak ada di products.warna sama sekali, jadi free-text, bukan
// dropdown spt "+ Tambah Warna".
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { zodErrorMessage } from "@/lib/api-error";

const requestSchema = z.object({ warna: z.string().trim().max(60) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: zodErrorMessage(body.error) }, { status: 400 });
  }
  const warna = body.data.warna || null;

  const supabase = await createClient();

  if (warna) {
    const { data: setRaw, error: setError } = await supabase
      .from("ai_generation_sets")
      .select("lineup_color_refs")
      .eq("id", id)
      .single();
    if (setError || !setRaw) {
      return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
    }
    const extraNames = ((setRaw.lineup_color_refs ?? []) as { warna: string }[]).map((r) =>
      r.warna.toUpperCase()
    );
    if (extraNames.includes(warna.toUpperCase())) {
      return NextResponse.json(
        { error: "Nama warna ini sudah dipakai salah satu warna tambahan" },
        { status: 400 }
      );
    }
  }

  const { error: updateError } = await supabase
    .from("ai_generation_sets")
    .update({ product_warna: warna })
    .eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: "Gagal menyimpan nama warna" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
