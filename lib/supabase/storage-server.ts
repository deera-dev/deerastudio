// Upload buffer (Node, server-side) ke Supabase Storage bucket
// "ai-fashion-studio". Terpisah dari lib/supabase/storage.ts, yang khusus
// browser (pakai canvas/createImageBitmap) — dipakai untuk upload hasil
// compositing foto produk (lib/images/composite-garment.ts) sebelum dikirim
// sebagai garment_image_url ke FLUX VTO. Pakai service-role client karena
// dipanggil dari Route Handler tanpa perlu ikatan RLS per-user.
import { createServiceRoleClient } from "./server";

const BUCKET = "ai-fashion-studio";

export async function uploadBufferToStorage(
  buffer: Buffer,
  folder: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const supabase = createServiceRoleClient();
  const ext = contentType === "image/png" ? "png" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
