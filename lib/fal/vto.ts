// STATUS: TIDAK DIPAKAI di pipeline utama sejak "Opsi B" (Agustus 2026,
// lihat lib/prompts/nano-banana-generate.ts) — digantikan 1 pemanggilan
// Nano Banana Pro. File ini SENGAJA dibiarkan (bukan dihapus) untuk
// referensi/kemungkinan fallback kalau suatu saat perlu dibandingkan lagi.
//
// Tahap 1: FASHN Virtual Try-On v1.6 — pakaikan produk ke foto model
// referensi. Lihat PRD §7.6 "Prompt Tahap 1".
//
// REVISI (Agustus 2026, setelah keluhan berulang soal motif/tekstur kain
// yang berubah/tidak akurat dari FLUX VTO): ganti model dari
// fal-ai/flux-pro/v1/vto (FLUX, general-purpose) ke fal-ai/fashn/tryon/v1.6
// (FASHN, model VTO purpose-built). Riset independen (fal.ai "Best Virtual
// Try-On APIs 2026") menyebut FASHN unggul khusus di "garment rendering
// accuracy" & preservasi motif/tekstur/print dibanding model diffusion
// generik seperti FLUX.
//
// PERBEDAAN PENTING dari versi lama:
// 1. FASHN TIDAK menerima prompt teks bebas — arsitekturnya khusus VTO,
//    bukan model edit-gambar umum. Jadi tidak ada lagi DEFAULT_VTO_PROMPT
//    di sini (IDENTITY_AND_COLOR_LOCK tetap dipakai, tapi hanya di tahap 2
//    Kontext untuk background — lihat lib/prompts/stage2.ts).
// 2. garmentImageUrl SEBAIKNYA satu foto flat-lay bersih (bukan komposit
//    multi-foto/kolase) — dokumentasi resmi FASHN dirancang & dites untuk
//    1 foto flat-lay/ghost-mannequin per panggilan (parameter
//    garment_photo_type), berbeda dari FLUX VTO yang dulu justru
//    menyarankan compositing multi-foto. lib/images/composite-garment.ts
//    masih ada di kodebase (belum dihapus) untuk dites lebih lanjut nanti,
//    tapi TIDAK dipakai di jalur utama saat ini supaya tidak jadi variabel
//    pembaur saat mengevaluasi apakah ganti model saja sudah cukup.
// 3. FASHN tidak selalu mengembalikan seed yang dipakai di response — jadi
//    seed di-generate sendiri di sini kalau tidak diberikan, supaya selalu
//    ada nilai pasti yang bisa dipakai ulang (mis. sharedSeed antar foto
//    "utama" & "angle" di generate-set/route.ts).
import { fal, FAL_MODELS } from "./client";

export interface VtoInput {
  humanImageUrl: string; // foto model/pose (PRD §7.3 poses.reference_image_url)
  garmentImageUrl: string; // foto flat-lay produk — satu foto bersih, lihat catatan di atas
  seed?: number;
}

export interface VtoResult {
  imageUrl: string;
  seed: number;
  generationTimeMs: number;
}

export async function runVirtualTryOn(input: VtoInput): Promise<VtoResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  const result = await fal.subscribe(FAL_MODELS.VIRTUAL_TRY_ON, {
    input: {
      model_image: input.humanImageUrl,
      garment_image: input.garmentImageUrl,
      category: "one-pieces", // seluruh katalog Deera adalah gamis/mukena (one-piece)
      mode: "quality", // prioritaskan akurasi motif/tekstur di atas kecepatan
      garment_photo_type: "flat-lay",
      seed,
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[] };

  return {
    imageUrl: data.images[0].url,
    seed,
    generationTimeMs: Date.now() - startedAt,
  };
}
