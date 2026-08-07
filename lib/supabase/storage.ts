// Upload file kerja (thumbnail model, foto pose, foto flat-lay produk) ke
// Supabase Storage bucket "ai-fashion-studio" (public read, lihat migration
// ai_fashion_studio_storage_bucket). Ini TERPISAH dari Cloudinary — Cloudinary
// hanya dipakai untuk hasil akhir yang di-publish ke katalog Deera (PRD §15,
// lib/cloudinary/client.ts). File di sini adalah working/intermediate file.
//
// Resize sebelum upload (ditambahkan setelah tes nyata pertama): foto HP raw
// bisa 8-12+ megapixel, jauh di atas batas fal-ai/flux-pro/v1/vto
// (human_image_url maks 2MP, garment_image_url maks 1MP, direkomendasikan
// lebih kecil dari itu). Kalau dikirim mentah, fal.ai downscale sendiri
// secara kasar sebelum diproses — bisa menghilangkan detail motif/bordir.
// Resize di sisi klien di bawah ini menjaga kualitas & mengurangi biaya.
import { createClient } from "./client";

const BUCKET = "ai-fashion-studio";
const MAX_DIMENSION = 1440;
const JPEG_QUALITY = 0.88;

async function resizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return file; // sudah cukup kecil, tidak perlu resize
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // Gagal resize (mis. format tidak didukung createImageBitmap) — upload apa adanya
    return file;
  }
}

export async function uploadToStorage(file: File, folder: string): Promise<string> {
  const resized = await resizeImage(file);
  const supabase = createClient();
  const ext = resized.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, resized, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
