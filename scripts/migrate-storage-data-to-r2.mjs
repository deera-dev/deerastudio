// Migrasi file LAMA (yang masih direferensikan aktif, bukan orphan -- lihat
// scripts/cleanup-orphan-storage.mjs utk orphan) dari Supabase Storage
// (bucket "ai-fashion-studio") ke Cloudflare R2, SEKALIGUS update semua
// kolom URL di database yang menunjuk ke file lama itu supaya ikut pindah
// ke URL R2 yang baru.
//
// SENGAJA dipecah jadi 3 tahap terpisah (lihat flag di bawah) -- JANGAN
// gabung jadi satu langkah "auto semua", krn tahap 2 (update DB) menyentuh
// data yang sedang dipakai aplikasi (gambar yang tampil di UI), dan tahap 3
// (hapus file lama) tidak bisa dibatalkan:
//
//   1. (default, tanpa flag)  DRY RUN -- cuma scan & laporan, tidak ubah apa-apa.
//   2. --migrate              Download tiap file dari Supabase, upload ke R2
//                             (path relatif SAMA PERSIS, cuma pindah "rumah"),
//                             simpan pemetaan url-lama -> url-baru ke file
//                             JSON lokal (migration-mapping.json). TIDAK
//                             menyentuh database maupun file lama sama sekali
//                             -- 100% aman & bisa diulang kapan saja.
//   3. --update-db            Baca migration-mapping.json, update SEMUA
//                             kolom URL di 9 tabel yang cocok ke URL baru.
//                             WAJIB jalankan --migrate dulu. Setelah ini,
//                             CEK DULU aplikasinya (foto2 masih tampil normal)
//                             sebelum lanjut ke langkah 4.
//   4. --delete-old           Baca migration-mapping.json, hapus file LAMA
//                             dari Supabase Storage (via Storage API asli).
//                             WAJIB jalankan --update-db dulu DAN sudah
//                             dicek aplikasinya jalan normal. Ini TIDAK BISA
//                             DIBATALKAN.
//
// Jalankan satu-satu, cek hasilnya tiap tahap, baru lanjut ke tahap berikutnya:
//   SUPABASE_SERVICE_ROLE_KEY=xxx R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx \
//   R2_SECRET_ACCESS_KEY=xxx R2_BUCKET_NAME=xxx R2_PUBLIC_URL=xxx \
//   node scripts/migrate-storage-data-to-r2.mjs            # tahap 1 dulu
//   ...                                            --migrate
//   ...                                            --update-db
//   ...                                            --delete-old

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, readFile } from "node:fs/promises";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://khpgjfsaucrhihadnewq.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "ai-fashion-studio";
const OLD_BASE = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const MAPPING_FILE = "migration-mapping.json";
const R2_ROOT_FOLDER = "deera-studio-working";

const MODE = process.argv.includes("--migrate")
  ? "migrate"
  : process.argv.includes("--update-db")
    ? "update-db"
    : process.argv.includes("--delete-old")
      ? "delete-old"
      : "dry-run";

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY belum diisi di environment.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
const R2_BUCKET = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

// Kolom per tabel yang mungkin menyimpan URL ke bucket ai-fashion-studio
// (text ATAU jsonb -- diperiksa generik lewat findUrlsDeep/replaceUrlsDeep
// di bawah, jadi tidak perlu tau persis struktur tiap kolom jsonb-nya).
// idColumn beda-beda per tabel -- SEMUA tabel ai_*/content_posts/
// freeform_generations pakai "id" (uuid), TAPI products pakai "kode"
// sbg primary key (tidak ada kolom "id" di tabel products).
const TABLE_CONFIG = {
  ai_models: { idColumn: "id", columns: ["thumbnail_url"] },
  ai_poses: { idColumn: "id", columns: ["reference_image_url"] },
  ai_background_presets: { idColumn: "id", columns: ["reference_image_url"] },
  ai_accessory_presets: { idColumn: "id", columns: ["reference_image_url"] },
  ai_generation_sets: {
    idColumn: "id",
    columns: ["product_images", "published_image_urls", "video_url", "lineup_color_refs"],
  },
  ai_generations: {
    idColumn: "id",
    columns: ["output_image_url", "output_thumb_url", "variant_product_images", "video_url", "vto_image_url"],
  },
  content_posts: { idColumn: "id", columns: ["image_urls", "video_url"] },
  freeform_generations: {
    idColumn: "id",
    columns: ["output_image_url", "output_thumb_url", "reference_image_urls"],
  },
  products: { idColumn: "kode", columns: ["image", "video", "detail", "warna_images", "seri_warna"] },
};

function findUrlsDeep(value, found) {
  if (typeof value === "string") {
    if (value.startsWith(OLD_BASE)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) findUrlsDeep(v, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) findUrlsDeep(v, found);
  }
}

// Kalau oldUrl ada di urlMap (hasil download+upload di run INI), pakai itu.
// Kalau tidak ada tapi masih berformat OLD_BASE, fallback ke URL R2 yg
// dihitung langsung dari relative path -- krn key R2 SELALU
// `${R2_ROOT_FOLDER}/${relativePath}` (sama persis di semua run), ini
// menangani referensi duplikat (misal file yg sama direferensikan dari
// product_images DAN lineup_color_refs) yg file-nya sudah pernah pindah
// di run sebelumnya tapi baru ketemu kolomnya belakangan.
function replaceUrlsDeep(value, urlMap) {
  if (typeof value === "string") {
    if (urlMap.has(value)) return urlMap.get(value);
    if (value.startsWith(OLD_BASE)) {
      const relativePath = value.slice(OLD_BASE.length);
      return `${R2_PUBLIC_URL}/${R2_ROOT_FOLDER}/${relativePath}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => replaceUrlsDeep(v, urlMap));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = replaceUrlsDeep(v, urlMap);
    return out;
  }
  return value;
}

async function fetchAllRows(table, idColumn, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select(`${idColumn}, ${columns.join(", ")}`)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

// Tahap 1 (dry-run, dipakai juga sbg dasar tahap 2): scan semua tabel, cari
// SEMUA url lama yang masih direferensikan + hitung berapa baris per tabel
// yang akan kesentuh.
async function scanReferencedUrls() {
  const allUrls = new Set();
  const perTable = {};
  for (const [table, { idColumn, columns }] of Object.entries(TABLE_CONFIG)) {
    const rows = await fetchAllRows(table, idColumn, columns);
    let rowsAffected = 0;
    for (const row of rows) {
      const found = new Set();
      for (const col of columns) findUrlsDeep(row[col], found);
      if (found.size > 0) {
        rowsAffected++;
        for (const u of found) allUrls.add(u);
      }
    }
    perTable[table] = { totalRows: rows.length, rowsAffected };
  }
  return { allUrls, perTable };
}

async function main() {
  if (MODE === "dry-run") {
    const { allUrls, perTable } = await scanReferencedUrls();
    console.log("Baris yang masih mereferensikan file di bucket ai-fashion-studio:");
    for (const [table, info] of Object.entries(perTable)) {
      console.log(`  ${table}: ${info.rowsAffected} / ${info.totalRows} baris`);
    }
    console.log(`\nTotal file unik yang perlu dipindah: ${allUrls.size}`);
    console.log("\nDRY RUN -- belum ada yang dipindah. Jalankan dengan --migrate utk mulai tahap 1 (copy file ke R2).");
    return;
  }

  if (MODE === "migrate") {
    if (!process.env.R2_ACCOUNT_ID || !R2_BUCKET || !R2_PUBLIC_URL) {
      console.error("R2_ACCOUNT_ID / R2_BUCKET_NAME / R2_PUBLIC_URL belum lengkap diisi.");
      process.exit(1);
    }
    const { allUrls } = await scanReferencedUrls();
    console.log(`Memindahkan ${allUrls.size} file dari Supabase Storage ke R2...`);
    const mapping = {};
    let done = 0;
    let consecutiveFails = 0;
    for (const oldUrl of allUrls) {
      const relativePath = oldUrl.slice(OLD_BASE.length);
      const key = `${R2_ROOT_FOLDER}/${relativePath}`;
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(relativePath);
        if (dlErr) {
          // 404 di Supabase -- mungkin file ini direferensikan dari 2 kolom
          // berbeda (mis. product_images DAN lineup_color_refs) dan sudah
          // kepindah+kehapus di run sebelumnya lewat kolom yg lain. Cek dulu
          // apakah key yg SAMA sudah ada di R2 sebelum dianggap gagal.
          if (dlErr.statusCode === "404" || dlErr.code === "NoSuchKey") {
            try {
              await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
              console.log(`  (sudah ada di R2 dari run sebelumnya, dilewati download) ${key}`);
              mapping[oldUrl] = `${R2_PUBLIC_URL}/${key}`;
              consecutiveFails = 0;
              done++;
              if (done % 50 === 0) console.log(`  ${done}/${allUrls.size}...`);
              continue;
            } catch {
              console.error(`  TIDAK DITEMUKAN di Supabase maupun R2 -- dilewati: ${oldUrl}`);
              done++;
              if (done % 50 === 0) console.log(`  ${done}/${allUrls.size}...`);
              continue;
            }
          }
          console.error("  DETAIL ERROR:", JSON.stringify(dlErr, Object.getOwnPropertyNames(dlErr)));
          throw new Error(`download gagal: ${dlErr.message}`);
        }
        const buffer = Buffer.from(await blob.arrayBuffer());
        const contentType = blob.type || "application/octet-stream";
        try {
          await r2.send(
            new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType })
          );
        } catch (r2Err) {
          console.error(
            `  DETAIL ERROR R2 (Bucket="${R2_BUCKET}", Key="${key}"):`,
            JSON.stringify(r2Err, Object.getOwnPropertyNames(r2Err))
          );
          throw r2Err;
        }
        mapping[oldUrl] = `${R2_PUBLIC_URL}/${key}`;
        consecutiveFails = 0;
      } catch (err) {
        console.error(`  GAGAL ${oldUrl}: ${err.message}`);
        consecutiveFails++;
        if (consecutiveFails >= 3) {
          console.error(
            "\n3 file pertama berturut-turut gagal -- berhenti di sini supaya tidak buang waktu. Cek detail error di atas."
          );
          process.exit(1);
        }
      }
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${allUrls.size}...`);
    }
    await writeFile(MAPPING_FILE, JSON.stringify(mapping, null, 2));
    console.log(`\nSelesai. ${Object.keys(mapping).length}/${allUrls.size} file berhasil dipindah ke R2.`);
    console.log(`Pemetaan url lama -> baru disimpan ke ${MAPPING_FILE}.`);
    console.log("Database BELUM diubah. Jalankan dengan --update-db setelah ini.");
    return;
  }

  if (MODE === "update-db") {
    const mapping = JSON.parse(await readFile(MAPPING_FILE, "utf8"));
    const urlMap = new Map(Object.entries(mapping));
    console.log(`Memakai pemetaan ${urlMap.size} url dari ${MAPPING_FILE}.`);

    for (const [table, { idColumn, columns }] of Object.entries(TABLE_CONFIG)) {
      const rows = await fetchAllRows(table, idColumn, columns);
      let updated = 0;
      for (const row of rows) {
        const patch = {};
        let changed = false;
        for (const col of columns) {
          const before = row[col];
          const after = replaceUrlsDeep(before, urlMap);
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            patch[col] = after;
            changed = true;
          }
        }
        if (changed) {
          const { error } = await supabase.from(table).update(patch).eq(idColumn, row[idColumn]);
          if (error) {
            console.error(`  GAGAL update ${table}#${row[idColumn]}: ${error.message}`);
            continue;
          }
          updated++;
        }
      }
      console.log(`  ${table}: ${updated} baris diupdate`);
    }
    console.log("\nSelesai update database. CEK DULU aplikasinya (foto2 tampil normal) sebelum --delete-old.");
    return;
  }

  if (MODE === "delete-old") {
    const mapping = JSON.parse(await readFile(MAPPING_FILE, "utf8"));
    const paths = Object.keys(mapping).map((oldUrl) => oldUrl.slice(OLD_BASE.length));
    console.log(`Menghapus ${paths.length} file lama dari Supabase Storage...`);
    let deleted = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      const { data, error } = await supabase.storage.from(BUCKET).remove(batch);
      if (error) {
        console.error(`  Batch ${i}-${i + batch.length} gagal: ${error.message}`);
        continue;
      }
      deleted += data?.length ?? batch.length;
      console.log(`  Terhapus ${deleted}/${paths.length}...`);
    }
    console.log(`\nSelesai. ${deleted} file lama terhapus dari Supabase Storage.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
