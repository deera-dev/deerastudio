// Cloudinary — dipakai HANYA untuk gambar final saat publish ke katalog
// Deera (PRD §13, §15). File kerja/percobaan tetap di Supabase Storage.
// Pakai akun Cloudinary Deera yang sama (VITE_CLOUDINARY_CLOUD_NAME di
// monorepo lama) — server-only, jangan expose api_secret ke client.
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export async function uploadPublishedImage(
  imageUrl: string,
  productKode: string,
  role: string
) {
  // Folder: deera/products/{product_kode}/ai-{role}.jpg — lihat PRD §13
  return cloudinary.uploader.upload(imageUrl, {
    folder: `deera/products/${productKode}`,
    public_id: `ai-${role}`,
    overwrite: true,
  });
}
