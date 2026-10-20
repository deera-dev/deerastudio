// publishWarnaSeriesToProduct — Oktober 2026.
// Admin: "saya ingin yang sudah berhasil tergenerate katalog warnanya,
// otomatis terupload ke serian warna produknya, kamu tau kan di tiap produk
// ada foto utama, foto seri dan foto detail lain" — begitu "Generate Lineup
// Warna" (katalog warna, lihat app/lineup-warna/page.tsx) berhasil, foto
// flat-lay tiap warna yang dipakai (ai_generation_sets.lineup_color_refs)
// otomatis dipublish ke products.warna_images ("foto seri" di katalog Deera
// utama — field yang sama dipakai jalur Publish History lama, lihat
// app/api/generation-sets/[id]/publish/route.ts), TANPA admin perlu klik
// publish terpisah.
//
// Dipanggil dari 2 tempat yang bisa menghasilkan baris kolase_warna:
// app/api/generation-sets/[id]/color-lineup/route.ts (generate pertama/ulang
// dari halaman Lineup Warna) & app/api/generations/[id]/regenerate/route.ts
// (regenerate lewat dialog generik di History). Sengaja TIDAK melempar error
// ke pemanggil kalau gagal (mis. Cloudinary/DB sempat down) — generation AI
// yang sudah berhasil & mahal itu JANGAN sampai dianggap gagal cuma krn
// langkah sync sekunder ini gagal; pemanggil cukup teruskan pesan error
// (kalau ada) ke admin sbg peringatan non-blocking.
//
// Merge ke warna_images yang SUDAH ADA (bukan overwrite total) — sama spt
// publish/route.ts — supaya sync 1-2 warna baru tidak menghapus warna lain
// yang sudah pernah dipublish dari jalur manapun.
import { createServiceRoleClient } from "@/lib/supabase/server";
import { uploadPublishedImage, slugifyWarna } from "@/lib/cloudinary/client";

export async function publishWarnaSeriesToProduct(
  productKode: string,
  lineupColorRefs: { warna: string; image: string }[]
): Promise<{ error: string | null }> {
  if (lineupColorRefs.length === 0) return { error: null };

  try {
    const uploads = await Promise.all(
      lineupColorRefs.map(async (r) => {
        const upload = await uploadPublishedImage(r.image, productKode, `seri-${slugifyWarna(r.warna)}`);
        return { warna: r.warna, url: upload.secure_url };
      })
    );

    const service = createServiceRoleClient();
    const { data: existingProduct } = await service
      .from("products")
      .select("warna_images")
      .eq("kode", productKode)
      .single();
    const existing = (existingProduct?.warna_images as Record<string, { image: string }> | null) ?? {};
    const merged = { ...existing };
    for (const u of uploads) merged[u.warna] = { image: u.url };

    const { error } = await service.from("products").update({ warna_images: merged }).eq("kode", productKode);
    if (error) return { error: "Gagal update serian warna produk" };
    return { error: null };
  } catch {
    return { error: "Gagal upload foto warna ke katalog produk" };
  }
}
