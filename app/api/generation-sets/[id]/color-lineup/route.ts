// POST /api/generation-sets/:id/color-lineup — Agustus 2026, REVISI BESAR.
// Admin awalnya minta "tambahin 1 lagi ya untuk serian warna, saya mau
// masukin jadi 1 foto aja digantung dengan hanger tanpa merubah detail
// sedikit pun" — versi PERTAMA endpoint ini murni compositing (TANPA AI).
// Setelah dikirimi referensi foto "colorway lineup" editorial (garment
// digantung rapi di hanger rail / fanned overlapping, styling studio
// premium — lihat reference yang dikirim admin) dan diminta "versi yang
// lebih bagusnya", endpoint ini PIVOT ke AI generation (Nano Banana Pro,
// lihat lib/prompts/color-lineup-generate.ts utk penjelasan lengkap +
// bagaimana "jangan ubah detail produk" tetap dijaga lewat prompt).
//
// Sumber FOTO REFERENSI per warna (dikirim ke AI sbg reference images, BUKAN
// dipakai literal sbg output lagi — beda dari versi pertama):
// - Warna utama -> set.product_images.fullBody (kalau ada) atau .front.
//   Label warnanya set.product_warna, atau "Utama" kalau kosong.
// - Tiap warna tambahan -> set.lineup_color_refs (jsonb {warna,image}[]).
//
// REVISI BESAR (Agustus 2026 — admin: "disini kan baru tersedia kalau seri
// warnanya sudah terfoto/generate, nah saya gamau itu karena akan boros
// credit, harus generate per seri foto satu2... saya bisa hanya attach foto
// asli flat ray masing-masing warnanya"): sumber warna tambahan DULU adalah
// baris ai_generations role "seri" (field variant_product_images.image) —
// yang keberadaannya MEWAJIBKAN admin generate 1 foto model penuh per warna
// dulu lewat "Tambah Warna Seri" di History (Rp2.700/warna, murni utk
// kebutuhan lain di luar lineup). Sekarang sumbernya
// ai_generation_sets.lineup_color_refs — foto flat-lay ASLI yang admin
// attach LANGSUNG di halaman Lineup Warna (app/api/generation-sets/[id]/
// lineup-color-refs/route.ts), TIDAK PERNAH memicu generate AI apa pun
// sebelum tombol "Generate Lineup Warna" ini sendiri diklik.
//
// Idempotent per set: kalau set ini SUDAH pernah generate lineup (ada baris
// image_role="kolase_warna"), panggilan berikutnya nge-UPDATE baris yang
// sama (bukan bikin baris baru).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runColorLineupGenerate, type ColorLineupReference } from "@/lib/prompts/color-lineup-generate";
import { renderColorLineupPng } from "@/lib/image-template/color-lineup";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import type { ProductImagesShape } from "@/lib/prompts/nano-banana-generate";

// Panggilan AI sinkron (fal.subscribe) — jatah waktu longgar, konsisten dgn
// route lain yg panggil Nano Banana Pro (lihat catatan BUG FIX maxDuration
// di app/api/generations/[id]/regenerate/route.ts).
export const maxDuration = 300;

const requestSchema = z.object({
  style: z.enum(["hanger", "fanned"]).optional().default("hanger"),
  styleNote: z.string().trim().max(300).optional(),
});

// Estimasi Rp — 1x panggilan Nano Banana Pro, sama seperti foto lain.
const COST_LINEUP = 2700;

type SetShape = {
  id: string;
  product_kode: string;
  product_images: ProductImagesShape;
  product_warna: string | null;
  lineup_color_refs: { warna: string; image: string }[];
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rawBody = await req.json().catch(() => ({}));
  const parsedBody = requestSchema.safeParse(rawBody);
  const style = parsedBody.success ? parsedBody.data.style : "hanger";
  const styleNote = parsedBody.success ? parsedBody.data.styleNote : undefined;

  const supabase = await createClient();

  const { data: setRaw, error: setError } = await supabase
    .from("ai_generation_sets")
    .select("id, product_kode, product_images, product_warna, lineup_color_refs")
    .eq("id", id)
    .single();
  if (setError || !setRaw) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  const set = setRaw as SetShape;

  const mainUrl = set.product_images.fullBody ?? set.product_images.front;
  if (!mainUrl) {
    return NextResponse.json(
      { error: "Set ini tidak punya foto warna utama tersimpan — tidak bisa buat lineup warna" },
      { status: 400 }
    );
  }

  const references: ColorLineupReference[] = [
    { url: mainUrl, label: set.product_warna || "Utama" },
    ...(set.lineup_color_refs ?? []).map((r) => ({ url: r.image, label: r.warna })),
  ];

  if (references.length < 2) {
    return NextResponse.json(
      {
        error:
          "Belum ada warna tambahan utk produk ini — tambah minimal 1 warna dulu (tombol \"+ Tambah Warna\") sebelum buat lineup warna",
      },
      { status: 400 }
    );
  }
  if (references.length > 7) {
    return NextResponse.json(
      { error: "Maksimal 7 warna (1 utama + 6 tambahan) per lineup — kurangi warna dulu" },
      { status: 400 }
    );
  }

  try {
    const generated = await runColorLineupGenerate({
      references,
      productKode: set.product_kode,
      style,
      styleNote,
    });

    const buffer = await renderColorLineupPng({
      heroImageUrl: generated.imageUrl,
      productKode: set.product_kode,
      colorLabels: references.map((r) => r.label),
    });
    const url = await uploadBufferToStorage(buffer, "generated-collages", "image/png");

    // Idempotent — cari baris kolase_warna yang SUDAH ADA di set ini dulu.
    const { data: existing } = await supabase
      .from("ai_generations")
      .select("id")
      .eq("generation_set_id", id)
      .eq("image_role", "kolase_warna")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("ai_generations")
        .update({
          output_image_url: url,
          status: "completed",
          generation_time_ms: generated.generationTimeMs,
          cost: COST_LINEUP,
          error_message: null,
        })
        .eq("id", existing.id);
      return NextResponse.json({ generationId: existing.id, imageUrl: url });
    }

    const { data: created, error: insertError } = await supabase
      .from("ai_generations")
      .insert({
        generation_set_id: id,
        image_role: "kolase_warna",
        pose_id: null,
        variant_warna: null,
        variant_product_images: null,
        vto_image_url: null,
        output_image_url: url,
        has_stage2: true,
        status: "completed",
        generation_time_ms: generated.generationTimeMs,
        cost: COST_LINEUP,
      })
      .select()
      .single();
    if (insertError || !created) {
      return NextResponse.json({ error: "Gagal menyimpan hasil lineup warna" }, { status: 500 });
    }

    return NextResponse.json({ generationId: created.id, imageUrl: url });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Gagal membuat lineup warna" },
      { status: 500 }
    );
  }
}
