// Hapus file di bucket "ai-fashion-studio" yang sudah tidak direferensikan
// kolom manapun di tabel ai_models/ai_poses/ai_background_presets/
// ai_accessory_presets/ai_generation_sets/ai_generations/content_posts/
// freeform_generations/products. Pakai Storage API asli (bukan SQL
// langsung ke storage.objects -- itu sengaja diblokir Supabase, lihat
// storage.protect_delete(), supaya tidak ada file "yatim" tanpa lewat
// jalur yang benar).
//
// Jalankan: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-orphan-storage.mjs
// (atau isi SUPABASE_SERVICE_ROLE_KEY di .env.local lalu `node --env-file=.env.local scripts/cleanup-orphan-storage.mjs`)
//
// Default DRY RUN (cuma print, tidak menghapus apa-apa). Tambah --delete
// di akhir perintah utk benar-benar menghapus.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://khpgjfsaucrhihadnewq.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "ai-fashion-studio";
const SAFETY_HOURS = 24; // jangan sentuh file yg dibuat < 24 jam terakhir
const DELETE = process.argv.includes("--delete");

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY belum diisi di environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = [
  "ai_models",
  "ai_poses",
  "ai_background_presets",
  "ai_accessory_presets",
  "ai_generation_sets",
  "ai_generations",
  "content_posts",
  "freeform_generations",
  "products",
];

async function fetchAllRows(table) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function collectReferencedPaths(rows) {
  const re = /ai-fashion-studio\/([A-Za-z0-9_\-./]+)/g;
  const refs = new Set();
  for (const row of rows) {
    const text = JSON.stringify(row);
    let m;
    while ((m = re.exec(text))) {
      refs.add(m[1].replace(/[")\]]+$/, ""));
    }
  }
  return refs;
}

// Lewat Storage API .list() (BUKAN query ke storage.objects via PostgREST
// -- schema "storage" ternyata tidak di-expose di project ini, lihat
// error "Invalid schema: storage"). .list() cuma baca 1 level per
// panggilan (tidak rekursif), jadi: list root dulu utk nemu semua
// "folder" (muncul sbg entry dgn id=null), lalu list tiap folder itu
// satu-satu. Struktur bucket ini selalu flat (folder/file.ext, tidak ada
// sub-folder bersarang), jadi 2 level cukup.
async function fetchAllStorageObjects() {
  const objects = [];
  const pageSize = 1000;

  async function listAll(prefix) {
    const entries = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(prefix, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`list "${prefix}": ${error.message}`);
      entries.push(...data);
      if (data.length < pageSize) break;
    }
    return entries;
  }

  const rootEntries = await listAll("");
  const folders = rootEntries.filter((e) => e.id === null);
  const rootFiles = rootEntries.filter((e) => e.id !== null);
  for (const f of rootFiles) {
    objects.push({ name: f.name, created_at: f.created_at, metadata: f.metadata });
  }

  for (const folder of folders) {
    const items = await listAll(folder.name);
    for (const item of items) {
      if (item.id === null) continue; // sub-folder bersarang, dilewati (struktur flat)
      objects.push({
        name: `${folder.name}/${item.name}`,
        created_at: item.created_at,
        metadata: item.metadata,
      });
    }
  }

  return objects;
}

async function main() {
  console.log(`Mengumpulkan path yang MASIH direferensikan dari ${TABLES.length} tabel...`);
  const referenced = new Set();
  for (const table of TABLES) {
    const rows = await fetchAllRows(table);
    for (const p of collectReferencedPaths(rows)) referenced.add(p);
    console.log(`  ${table}: ${rows.length} baris`);
  }
  console.log(`Total path yang direferensikan: ${referenced.size}`);

  console.log(`Mengambil daftar file di bucket "${BUCKET}"...`);
  const objects = await fetchAllStorageObjects();
  console.log(`Total file di bucket: ${objects.length}`);

  const cutoff = Date.now() - SAFETY_HOURS * 3600 * 1000;
  const orphans = objects.filter(
    (o) => !referenced.has(o.name) && new Date(o.created_at).getTime() < cutoff
  );

  const totalBytes = orphans.reduce((s, o) => s + (Number(o.metadata?.size) || 0), 0);
  console.log(
    `\nOrphan ditemukan: ${orphans.length} file, ${(totalBytes / 1024 / 1024).toFixed(1)} MB ` +
      `(sudah lebih dari ${SAFETY_HOURS} jam & tidak direferensikan tabel manapun).`
  );

  if (!DELETE) {
    console.log("\nDRY RUN -- tidak ada yang dihapus. Jalankan ulang dengan --delete utk benar2 menghapus.");
    console.log("Contoh 10 path pertama yang akan dihapus:");
    for (const o of orphans.slice(0, 10)) console.log(`  ${o.name}`);
    return;
  }

  console.log("\nMenghapus lewat Storage API (batch 100)...");
  const paths = orphans.map((o) => o.name);
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
  console.log(`\nSelesai. ${deleted} file terhapus (~${(totalBytes / 1024 / 1024).toFixed(1)} MB).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
