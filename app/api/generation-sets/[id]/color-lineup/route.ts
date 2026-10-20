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
// set.lineup_color_refs (jsonb {warna,image}[]) — foto flat-lay ASLI yang
// admin attach LANGSUNG di halaman Lineup Warna (app/api/generation-sets/
// [id]/lineup-color-refs/route.ts), TIDAK PERNAH memicu generate AI apa pun
// sebelum tombol "Generate Lineup Warna" ini sendiri diklik.
//
// REVISI BESAR (Agustus 2026 — admin: "disini kan baru tersedia kalau seri
// warnanya sudah terfoto/generate, nah saya gamau itu karena akan boros
// credit, harus generate per seri foto satu2... saya bisa hanya attach foto
// asli flat ray masing-masing warnanya"): sumber warna tambahan DULU adalah
// baris ai_generations role "seri" (field variant_product_images.image) —
// yang keberadaannya MEWAJIBKAN admin generate 1 foto model penuh per warna
// dulu lewat "Tambah Warna Seri" di History (Rp2.700/warna, murni utk
// kebutuhan lain di luar lineup).
//
// REVISI (Oktober 2026 — admin: "foto utama gausah ada harusnya... cukup
// tidak usah dipakai aja foto utamanya, di tampilan itu cukup file2 image
// baru yang diupload aja"): set.product_images (foto katalog/AI Studio)
// DIHAPUS sepenuhnya dari sumber referensi — kadang kebetulan sama persis
// dgn salah satu warna yang sudah di-upload ulang terpisah di sini, bikin 1
// warna terkirim dobel ke AI. lineup_color_refs sekarang SATU-SATUNYA
// sumber.
//
// Idempotent per set: kalau set ini SUDAH pernah generate lineup (ada baris
// image_role="kolase_warna"), panggilan berikutnya nge-UPDATE baris yang
// sama (bukan bikin baris baru).
//
// REVISI (Oktober 2026 — admin: "saya ingin yang sudah berhasil tergenerate
// katalog warnanya, otomatis terupload ke serian warna produknya"): begitu
// generate di sini SUKSES, tiap foto flat-lay di lineup_color_refs otomatis
// dipublish ke products.warna_images ("foto seri" katalog Deera utama) lewat
// publishWarnaSeriesToProduct() — admin tidak perlu publish manual terpisah
// lagi khusus utk warna. Non-blocking: kalau sync ini gagal, generation yang
// sudah sukses & mahal TETAP disimpan, cuma warnaSyncError diisi di response
// sbg peringatan (lihat app/lineup-warna/page.tsx handleGenerate).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  runColorLineupGenerate,
  orderColorReferences,
  type ColorLineupReference,
} from "@/lib/prompts/color-lineup-generate";
import { renderColorLineupPng } from "@/lib/image-template/color-lineup";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";
import { makeThumbnailUrl } from "@/lib/images/mirror-output";
import { publishWarnaSeriesToProduct } from "@/lib/catalog/publish-warna-series";
import { errorMessage } from "@/lib/api-error";

// Panggilan AI sinkron (fal.subscribe) — jatah waktu longgar, konsisten dgn
// route lain yg panggil Nano Banana Pro (lihat catatan BUG FIX maxDuration
// di app/api/generations/[id]/regenerate/route.ts).
export const maxDuration = 300;

const requestSchema = z.object({
  style: z.enum(["hanger", "fanned", "folded", "flatlay"]).optional().default("hanger"),
  styleNote: z.string().trim().max(300).optional(),
});

// Estimasi Rp — 1x panggilan Nano Banana Pro, sama seperti foto lain.
const COST_LINEUP = 2700;

type SetShape = {
  id: string;
  product_kode: string;
  lineup_color_refs: { warna: string; image: string }[];
  lineup_color_order: string[];
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
    .select("id, product_kode, lineup_color_refs, lineup_color_order")
    .eq("id", id)
    .single();
  if (setError || !setRaw) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }
  const set = setRaw as SetShape;

  // Urutan tampil warna (admin: "saya ingin bisa mengatur posisi
  // warnanya") — lihat orderColorReferences() utk logic self-healing.
  const references: ColorLineupReference[] = orderColorReferences(
    (set.lineup_color_refs ?? []).map((r) => ({ warna: r.warna, ref: { url: r.image, label: r.warna } })),
    set.lineup_color_order
  );

  if (references.length < 2) {
    return NextResponse.json(
      {
        error:
          "Minimal 2 warna dulu (tombol \"+ Tambah Warna\") sebelum buat lineup warna",
      },
      { status: 400 }
    );
  }
  if (references.length > 7) {
    return NextResponse.json(
      { error: "Maksimal 7 warna per lineup — kurangi warna dulu" },
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
    const thumbUrl = await makeThumbnailUrl(buffer, "generated-collages");

    // Sync ke products.warna_images — lihat REVISI Oktober 2026 di atas.
    // Dijalankan SEBELUM nyimpan baris ai_generations biar warnaSyncError
    // sudah siap dikirim bareng di response sukses (satu round-trip).
    const { error: warnaSyncError } = await publishWarnaSeriesToProduct(
      set.product_kode,
      set.lineup_color_refs ?? []
    );

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
          output_thumb_url: thumbUrl,
          status: "completed",
          generation_time_ms: generated.generationTimeMs,
          cost: COST_LINEUP,
          error_message: null,
        })
        .eq("id", existing.id);
      return NextResponse.json({ generationId: existing.id, imageUrl: url, warnaSyncError });
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
        output_thumb_url: thumbUrl,
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

    return NextResponse.json({ generationId: created.id, imageUrl: url, warnaSyncError });
  } catch (err) {
    return NextResponse.json(
      { error: errorMessage(err, "Gagal membuat lineup warna") },
      { status: 500 }
    );
  }
}
