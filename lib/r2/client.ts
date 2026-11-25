// Client S3-compatible utk Cloudflare R2 -- storage utama file kerja AI
// Fashion Studio (lihat lib/r2/storage-server.ts). Dipilih Nov 2026
// menggantikan rencana awal pindah ke Cloudinary (lihat riwayat PR) krn
// R2 storage gratisnya lebih besar (10GB vs 3GB kompetitor) DAN egress-nya
// gratis SELAMANYA tanpa batas (beda dari Supabase yg kena restriksi
// total saat kuota lewat) -- lihat docs/PRD-AI-Fashion-Studio.md §22 utk
// riwayat lengkap kenapa Supabase Storage ditinggalkan.
import { S3Client } from "@aws-sdk/client-s3";

export const R2_BUCKET = process.env.R2_BUCKET_NAME || "deera-studio";

// Base URL publik utk baca file (r2.dev public bucket URL, atau custom
// domain kalau sudah disambungkan di Cloudflare dashboard) -- WAJIB diisi
// tanpa trailing slash, mis. "https://pub-xxxxxxxx.r2.dev".
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
