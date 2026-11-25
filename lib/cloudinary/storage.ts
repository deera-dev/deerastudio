// Upload file dari browser (model thumbnail, foto pose, foto referensi
// koreksi, dst) -- pengganti lib/supabase/storage.ts. Resize client-side
// SAMA PERSIS dgn versi lama (lihat alasannya di komentar lib/supabase/
// storage.ts: batas ukuran fal-ai/flux-pro/v1/vto), tapi upload-nya lewat
// /api/upload-working-image (bukan langsung ke provider) krn Cloudinary
// tidak punya skema "anon key aman" setara Supabase utk upload langsung
// dari browser tanpa upload preset.
//
// Signature SENGAJA dibuat identik dgn uploadToStorage lama
// (File, folder) -> Promise<string> supaya pemanggilnya (ImageUploadField,
// dkk) cukup ganti import-nya saja.
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
  const form = new FormData();
  form.append("file", resized);
  form.append("folder", folder);

  const res = await fetch("/api/upload-working-image", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload gagal");
  return data.url as string;
}
