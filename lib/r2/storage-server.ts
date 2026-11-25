// Upload buffer (Node, server-side) ke Cloudflare R2 -- pengganti
// lib/supabase/storage-server.ts (bucket "ai-fashion-studio" kena Fair
// Use restriction Supabase krn Storage Size melebihi kuota free tier,
// lihat riwayat Nov 2026). File kerja/intermediate (foto hasil generate,
// thumbnail, kolase, dll) disimpan di sini -- bucket R2 terpisah,
// BUKAN Cloudinary (yang tetap dipakai HANYA utk publish final ke katalog,
// lihat lib/cloudinary/client.ts, tidak diubah).
//
// Signature SENGAJA dibuat identik dgn uploadBufferToStorage lama
// (Buffer, folder, contentType) -> Promise<string> supaya pemanggilnya
// (mirror-output.ts, render-poster, generate-marketing-photo, dst) cukup
// ganti import-nya saja, tanpa ubah kode lain.
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "./client";

function extFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadBufferToStorage(
  buffer: Buffer,
  folder: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const key = `${folder}/${crypto.randomUUID()}.${extFromContentType(contentType)}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${R2_PUBLIC_URL}/${key}`;
}
