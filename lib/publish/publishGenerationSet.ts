// Logic inti "publish ke katalog Deera" (PRD §15) — diekstrak dari
// app/api/generation-sets/[id]/publish/route.ts (November 2026) supaya bisa
// dipanggil ulang dari tempat lain, bukan cuma lewat tombol "Publish ke
// Katalog" manual. Dipakai pertama kali oleh app/api/generation-sets/[id]/
// transfer/route.ts: kalau set yang dipindah KODE-nya sudah pernah
// dipublish sebelumnya, transfer otomatis publish ulang ke kode BARU (admin
// minta ini otomatis, bukan manual lagi) — tanpa duplikasi logic upload
// Cloudinary + merge warna_images.
import { uploadPublishedImage, slugifyWarna } from "@/lib/cloudinary/client";
import type { createClient, createServiceRoleClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

export type PublishImageIds = {
  utama: string;
  detail: string[];
  seri: string[];
};

export class PublishValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function publishGenerationSet(
  supabase: SupabaseServerClient,
  service: ServiceRoleClient,
  setId: string,
  productKode: string,
  imageIds: PublishImageIds
) {
  const allIds = [imageIds.utama, ...imageIds.detail, ...imageIds.seri];
  const { data: generations } = await supabase
    .from("ai_generations")
    .select("id, image_role, output_image_url, status, variant_warna")
    .in("id", allIds);

  const notReady = generations?.find((g) => g.status !== "completed");
  if (notReady) {
    throw new PublishValidationError("Hanya gambar berstatus completed yang bisa dipublish");
  }

  const byId = new Map((generations ?? []).map((g) => [g.id, g]));

  const utama = byId.get(imageIds.utama);
  if (!utama || !utama.output_image_url) {
    throw new PublishValidationError("Foto utama tidak ditemukan atau belum ada hasilnya");
  }

  const detailUploads = await Promise.all(
    imageIds.detail.map((genId, i) =>
      uploadPublishedImage(byId.get(genId)!.output_image_url!, productKode, `detail-${i + 1}` as const)
    )
  );
  const utamaUpload = await uploadPublishedImage(utama.output_image_url, productKode, "utama");

  const seriGens = imageIds.seri
    .map((genId) => byId.get(genId)!)
    .filter((g) => g?.variant_warna); // baris seri lama tanpa variant_warna diabaikan, tidak bisa dipetakan ke warna

  const seriUploads = await Promise.all(
    seriGens.map(async (g) => {
      const upload = await uploadPublishedImage(
        g.output_image_url!,
        productKode,
        `seri-${slugifyWarna(g.variant_warna!)}`
      );
      return { warna: g.variant_warna!, url: upload.secure_url };
    })
  );

  // Merge ke warna_images yang sudah ada di products (bukan overwrite total)
  // supaya publish satu-dua warna baru tidak menghapus warna lain yang sudah
  // pernah dipublish sebelumnya.
  let mergedWarnaImages: Record<string, { image: string }> | null = null;
  if (seriUploads.length > 0) {
    const { data: existingProduct } = await service
      .from("products")
      .select("warna_images")
      .eq("kode", productKode)
      .single();
    const existing = (existingProduct?.warna_images as Record<string, { image: string }> | null) ?? {};
    mergedWarnaImages = { ...existing };
    for (const u of seriUploads) {
      mergedWarnaImages[u.warna] = { image: u.url };
    }
  }

  // NOTE: ini OVERWRITE data live products.image/detail (dan merge warna_images)
  // — sesuai PRD §15, admin harus sudah dapat konfirmasi eksplisit di UI
  // sebelum fungsi ini dipanggil (aturan "Explicit permission required"
  // utk data yg tampil publik) — baik lewat tombol Publish manual, maupun
  // lewat dialog konfirmasi "Pindah Produk" (transfer/route.ts).
  const { error: updateError } = await service
    .from("products")
    .update({
      image: utamaUpload.secure_url,
      detail: detailUploads.map((u) => u.secure_url),
      ...(mergedWarnaImages ? { warna_images: mergedWarnaImages } : {}),
    })
    .eq("kode", productKode);

  if (updateError) {
    throw new PublishValidationError("Gagal update produk Deera", 500);
  }

  const publishedImageUrls = {
    image: utamaUpload.secure_url,
    detail: detailUploads.map((u) => u.secure_url),
    ...(seriUploads.length > 0
      ? { warna_images: Object.fromEntries(seriUploads.map((u) => [u.warna, u.url])) }
      : {}),
  };

  const publishedAt = new Date().toISOString();
  await supabase
    .from("ai_generation_sets")
    .update({ published_at: publishedAt, published_image_urls: publishedImageUrls })
    .eq("id", setId);

  return { publishedAt, cloudinaryUrls: publishedImageUrls };
}

// Turunkan imageIds default dari generations satu set, sama persis dgn
// seleksi yang dipakai handlePublish() di app/history/page.tsx (utama = 1
// baris role "utama", detail = semua non-utama/non-seri, seri = semua role
// "seri") — dipakai saat publish ulang otomatis TIDAK punya seleksi manual
// dari client (transfer/route.ts, server-side, tidak ada UI).
export function deriveDefaultImageIds(
  generations: { id: string; image_role: string; status: string }[]
): { imageIds: PublishImageIds; allCompleted: boolean } | null {
  const utama = generations.find((g) => g.image_role === "utama");
  if (!utama) return null;
  const detail = generations.filter((g) => g.image_role !== "utama" && g.image_role !== "seri");
  const seri = generations.filter((g) => g.image_role === "seri");
  const allCompleted =
    utama.status === "completed" &&
    detail.every((d) => d.status === "completed") &&
    seri.every((s) => s.status === "completed");
  return {
    imageIds: { utama: utama.id, detail: detail.map((d) => d.id), seri: seri.map((s) => s.id) },
    allCompleted,
  };
}
