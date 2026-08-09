// Loader font & logo bersama — dipakai poster.tsx (Poster AI, Content
// Studio) DAN set-collage.tsx (kolase set foto Generate/History, Agustus
// 2026). Diekstrak dari poster.tsx supaya tidak duplikat logic loadFonts/
// loadLogoDataUri di dua tempat (keduanya pakai font & logo Deera yang
// SAMA persis). Server-only (pakai node:fs).
import { readFile } from "node:fs/promises";
import path from "node:path";

const FONT_DIR = path.join(process.cwd(), "lib/image-template/fonts");
const ASSET_DIR = path.join(process.cwd(), "lib/image-template/assets");

export type TemplateFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal";
};

let fontsCache: TemplateFont[] | null = null;
let logoDataUriCache: string | null = null;
let brandIconDataUriCache: string | null = null;
let brandWordmarkDataUriCache: string | null = null;

export async function loadFonts(): Promise<TemplateFont[]> {
  if (fontsCache) return fontsCache;
  const [frauncesSemi, frauncesBold, alexBrush, poppinsReg, poppinsSemi] = await Promise.all([
    readFile(path.join(FONT_DIR, "Fraunces-SemiBold.ttf")),
    readFile(path.join(FONT_DIR, "Fraunces-Bold.ttf")),
    readFile(path.join(FONT_DIR, "AlexBrush-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Poppins-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Poppins-SemiBold.ttf")),
  ]);
  fontsCache = [
    { name: "Fraunces", data: frauncesSemi, weight: 600, style: "normal" },
    { name: "Fraunces", data: frauncesBold, weight: 700, style: "normal" },
    { name: "AlexBrush", data: alexBrush, weight: 400, style: "normal" },
    { name: "Poppins", data: poppinsReg, weight: 400, style: "normal" },
    { name: "Poppins", data: poppinsSemi, weight: 600, style: "normal" },
  ];
  return fontsCache;
}

export async function loadLogoDataUri(): Promise<string> {
  if (logoDataUriCache) return logoDataUriCache;
  const buf = await readFile(path.join(ASSET_DIR, "logo-mark.png"));
  logoDataUriCache = `data:image/png;base64,${buf.toString("base64")}`;
  return logoDataUriCache;
}

// Logo brand Deera Indonesia PENUH (ikon rusa hijau tua + wordmark "DEERA /
// Graceful Elegance"), Agustus 2026 — dipakai set-collage.tsx (kolase "4
// foto" Generate/History, lihat referensi lookbook nyata yang dikirim
// admin). BEDA dari logo-mark.png di atas (versi PUTIH, cuma dipakai di
// atas foto GELAP di Poster AI) — logo ini versi HIJAU asli brand, dipakai
// di atas latar TERANG (krem/putih) di kolase.
//
// File asal (`apps/catalog/public/logo.png` = ikon, `apps/admin/public/
// logo-deera.png` = wordmark) ada di monorepo deeraindonesia (app bisnis
// Deera yang sama, project Supabase yang sama) — DI-COPY ke folder assets
// app ini (bukan dibaca lintas-repo saat runtime, supaya app ini tetap
// mandiri) dan di-downscale dari resolusi asli (~5300px/~7000px lebar,
// terlalu besar utk base64 data URI Satori) ke ukuran wajar. Kalau logo
// resmi Deera berubah, copy ulang dari monorepo deeraindonesia
// (`apps/catalog/public/logo.png` & `apps/admin/public/logo-deera.png`),
// downscale ke ~500px/~900px lebar, timpa file di sini — TIDAK perlu ubah
// kode render.
export async function loadBrandIconDataUri(): Promise<string> {
  if (brandIconDataUriCache) return brandIconDataUriCache;
  const buf = await readFile(path.join(ASSET_DIR, "brand-icon-green.png"));
  brandIconDataUriCache = `data:image/png;base64,${buf.toString("base64")}`;
  return brandIconDataUriCache;
}

export async function loadBrandWordmarkDataUri(): Promise<string> {
  if (brandWordmarkDataUriCache) return brandWordmarkDataUriCache;
  const buf = await readFile(path.join(ASSET_DIR, "brand-wordmark-green.png"));
  brandWordmarkDataUriCache = `data:image/png;base64,${buf.toString("base64")}`;
  return brandWordmarkDataUriCache;
}
