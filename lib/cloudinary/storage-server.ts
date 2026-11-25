// Upload buffer (Node, server-side) ke Cloudinary -- pengganti
// lib/supabase/storage-server.ts (bucket "ai-fashion-studio" kena Fair Use
// restriction Supabase krn Storage Size melebihi kuota free tier, lihat
// percakapan Nov 2026). File kerja/intermediate (foto hasil generate,
// thumbnail, kolase, dll) pindah ke sini -- akun Cloudinary yang SAMA
// dengan yang sudah dipakai utk publish ke katalog (lib/cloudinary/client.ts),
// tapi folder TERPISAH ("deera-studio-working/...") supaya tidak campur
// dgn namespace "deera/products/..." punya katalog yang sudah di-publish.
//
// Signature SENGAJA dibuat identik dgn uploadBufferToStorage lama
// (Buffer, folder, contentType) -> Promise<string> supaya pemanggilnya
// (mirror-output.ts, render-poster, generate-marketing-photo, dst) cukup
// ganti import-nya saja, tanpa ubah kode lain.
import { cloudinary } from "./client";

const ROOT_FOLDER = "deera-studio-working";

export async function uploadBufferToStorage(
  buffer: Buffer,
  folder: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const resourceType = contentType.startsWith("video/") ? "video" : "image";
  const publicId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `${ROOT_FOLDER}/${folder}`,
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload gagal tanpa pesan error"));
          return;
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}
