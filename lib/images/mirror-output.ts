// Salin hasil generate (URL CDN fal.ai) ke Supabase Storage + buat thumbnail
// JPEG ringan — Oktober 2026. Admin: "kenapa render foto yang sudah
// digenerate lama banget, lebih cepet buka url image-nya langsung".
//
// Akar masalah: output_image_url sebelumnya langsung URL fal.ai berupa PNG
// 2K lossless (beberapa MB/foto), dan grid History memuat SEMUA foto dalam
// ukuran penuh. Sekarang tiap hasil disalin ke storage kita (sekalian
// terhindar dari URL fal.ai yg bisa kedaluwarsa) dan dibuatkan thumbnail
// JPEG ~720px (puluhan KB) utk grid/list; PNG penuh hanya dibuka saat foto
// di-klik (lightbox/download).
import sharp from "sharp";
import { uploadBufferToStorage } from "@/lib/supabase/storage-server";

const THUMB_WIDTH = 720;

export type MirroredOutput = { fullUrl: string; thumbUrl: string | null };

export async function makeThumbnailUrl(
  source: Buffer,
  folder: string
): Promise<string | null> {
  try {
    const thumb = await sharp(source)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return await uploadBufferToStorage(thumb, `${folder}-thumb`, "image/jpeg");
  } catch (err) {
    console.error("[mirror-output] gagal buat thumbnail:", err);
    return null;
  }
}

// Download dari URL fal.ai -> upload PNG penuh + thumbnail. Kalau salah satu
// langkah gagal, JANGAN gagalkan generate yg sudah dibayar: fallback ke URL
// asli (full) tanpa thumbnail.
export async function mirrorOutputImage(
  sourceUrl: string,
  folder = "generated"
): Promise<MirroredOutput> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const [fullUrl, thumbUrl] = await Promise.all([
      uploadBufferToStorage(buffer, folder, "image/png"),
      makeThumbnailUrl(buffer, folder),
    ]);
    return { fullUrl, thumbUrl };
  } catch (err) {
    console.error("[mirror-output] gagal salin, pakai URL asli:", err);
    return { fullUrl: sourceUrl, thumbUrl: null };
  }
}
