# Deera Studio

Aplikasi internal Deera untuk generate **foto & video katalog gamis/mukena**
pakai AI (Nano Banana Pro single-stage, lihat di bawah), pengganti sebagian
besar proses foto studio vendor, plus **Content Studio** untuk generate &
publish konten marketing Instagram (caption, poster, foto editorial, video
Reel). Dulu bernama "AI Fashion Studio". Dokumen lengkap (status implementasi
terkini, arsitektur, keputusan desain): [`docs/PRD-AI-Fashion-Studio.md`](./docs/PRD-AI-Fashion-Studio.md).

> **Catatan:** README ini (dan PRD di atas) sempat cukup lama tidak
> disinkronkan dengan kode — per 9 Agustus 2026 keduanya sudah ditulis ulang
> untuk mencerminkan implementasi terkini. Kalau ada bagian yang terasa tidak
> cocok dengan kode yang kamu lihat, PRD §22 punya riwayat pivot arsitektur
> lengkap (kenapa berubah dari rencana awal).

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Desain sistem dark glassmorphism custom (`components/ui/`) — bukan
  shadcn/ui seperti rencana awal
- Supabase — **project sama dengan Deera** (`deeraindonesia`, project ref
  `khpgjfsaucrhihadnewq`), bukan project baru. Tabel baru pakai prefix `ai_`
  (`ai_models`, `ai_poses`, `ai_background_presets`, `ai_accessory_presets`,
  `ai_generation_sets`, `ai_generations`, `ai_cost_log`) + `content_posts`
  (Content Studio, tanpa prefix).
- Fal.ai — **Nano Banana Pro edit** (mesin utama, single-stage — bukan lagi
  FLUX VTO + Kontext dua tahap terpisah), FLUX Kontext Pro (crop foto detail
  saja), Kling 3.0 Pro (video), ffmpeg-api/merge-videos (gabung video),
  openrouter/router (text-gen Content Studio). Lihat PRD §9 untuk detail
  peran tiap model.
- Cloudinary — untuk gambar final saat publish ke katalog Deera (akun
  Cloudinary Deera yang sama)
- Instagram Graph API — publish konten Content Studio (opsional)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Isi environment variables**

   `.env.local` sudah terisi `NEXT_PUBLIC_SUPABASE_URL` dan
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (project Deera, aman diexpose ke browser).
   Yang masih perlu diisi manual (rahasia, jangan commit):

   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard project `deeraindonesia`
     > Project Settings > API > service_role key. Dipakai `lib/supabase/
     server.ts` (`createServiceRoleClient()`) untuk aksi yang butuh bypass
     RLS: publish hasil ke `products.*`, dan pencatatan biaya AI ke
     `ai_cost_log` (`lib/cost-log.ts`).
   - `FAL_KEY` — buat akun di [fal.ai](https://fal.ai/dashboard/keys), isi
     saldo (lihat estimasi biaya di PRD §20 — pantau juga lewat Dashboard
     app ini sendiri setelah jalan, lihat §Cost tracking di bawah)
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
     — akun Cloudinary Deera yang sudah ada
   - `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_BUSINESS_ACCOUNT_ID` — opsional,
     lihat §Content Studio & Instagram di bawah

3. **Sinkronkan skema database**

   Migration awal ada di
   `supabase/migrations/20260807000000_ai_fashion_studio_init.sql`, tapi
   **skema live project sudah jauh lebih baru** dari file itu — banyak
   perubahan (kolom video di `ai_generation_sets`, tabel `content_posts`,
   tabel `ai_cost_log`, `product_images.detailHand`, `products.warna_images`,
   dst) diterapkan langsung ke project lewat migration terpisah yang belum
   semuanya di-export jadi file lokal di repo ini.

   Kalau setup project BARU dari nol (bukan lanjut kerja di project yang
   sudah ada): jangan cuma andalkan file migration di atas. Cek
   `types/database.ts` sebagai sumber kebenaran struktur data terkini
   (`GenerationSet`, `Generation`, `ContentPost`), atau tarik skema live
   lewat Supabase CLI:

   ```bash
   npx supabase link --project-ref khpgjfsaucrhihadnewq
   npx supabase db pull
   ```

   Kalau kamu memang perlu apply migration baru, review dulu isinya sebelum
   `db push` — project ini dipakai bersama app lain (`catalog`/`admin`/
   `pos`/`finance`), jangan sampai migration menyentuh tabel Deera yang
   sudah ada.

4. **Jalankan dev server**

   ```bash
   npm run dev
   ```

   Buka http://localhost:3000 — akan redirect ke `/login` kalau belum
   autentikasi (reuse akun `@deera.id` yang sama dengan admin.deera.id).

## Struktur folder

```
app/
  login/                     Login (reuse Supabase Auth Deera), background KineticGrid
  dashboard/                 Statistik + rincian biaya per fitur + "perlu perhatian" + aktivitas terbaru
  models/                    CRUD model AI (dengan edit inline)
  poses/                     CRUD pose per model (dengan edit inline)
  presets/                   CRUD background & aksesoris (dengan edit inline, termasuk gambar)
  generate/                  Halaman utama generate 1 set foto (Nano Banana Pro single-stage)
  history/                   Riwayat (pagination+search) + Publish + Tambah Warna Seri + Generate Video
  content/                   Content Studio — caption/hashtag, Poster AI, Foto Marketing/Gabungan AI, video Reel, kalender, publish Instagram
  api/
    generate-set/                        POST — generate 1 set foto
    generation-sets/[id]/                GET detail; publish/ POST; add-seri/ POST; generate-video/ POST + status/ GET
    generations/[id]/regenerate/         POST — generate ulang 1 gambar
    content/                             generate-caption/, generate-calendar/, instagram-status/,
                                          suggest-headline/, suggest-storyboard/, suggest-group-storyboard/,
                                          render-poster/, generate-marketing-photo/, generate-combo-photo/,
                                          generate-video/ + status/
    content-posts/                       POST buat draft; [id]/ PATCH/DELETE; [id]/publish/ POST

lib/
  supabase/          client.ts (browser), server.ts (server + service-role), storage.ts/storage-server.ts (upload ke bucket ai-fashion-studio)
  fal/                client.ts (FAL_MODELS + kredensial), text.ts (text-gen), video.ts (Kling + ffmpeg merge, submit/status/reconcile)
  prompts/            nano-banana-generate.ts (foto utama/angle/seri), stage2.ts (crop detail via Kontext),
                       background-composer.ts, content-generate.ts (caption/headline/storyboard Content Studio),
                       video-motion.ts (motion prompt per image_role), marketing-photo.ts, combo-photo.ts
  cost-log.ts         logAiCost() — server-only, catat biaya ke ai_cost_log (lihat §Cost tracking)
  cost-log-shared.ts  Tipe/label/usdToRp — client-safe, dipakai Dashboard (JANGAN import lib/cost-log.ts dari Client Component, lihat komentar di file)
  instagram/          Graph API publish wrapper (client.ts)
  image-template/     poster.tsx (render poster via next/og ImageResponse), color-map.ts, fonts/, assets/

types/database.ts           Tipe TypeScript sumber kebenaran skema (lebih baru dari migration file, lihat §3 Setup)
supabase/migrations/        Migration SQL (TIDAK lengkap — lihat §3 Setup)
docs/PRD-AI-Fashion-Studio.md   PRD lengkap (v1.0) — status implementasi & keputusan desain terkini
```

## Pencatatan biaya AI (`ai_cost_log`)

Setiap panggilan AI berbayar dicatat ke tabel `ai_cost_log` lewat
`logAiCost()` (`lib/cost-log.ts`, service-role, best-effort — gagal catat
TIDAK PERNAH menggagalkan fitur utama). Ini dibuat setelah ditemukan gap
nyata: Dashboard versi sebelumnya hanya menjumlah `ai_generation_sets.
total_cost`, melewatkan `video_cost` (kolom terpisah di tabel yang sama)
DAN seluruh biaya Content Studio (caption/headline/storyboard AI, Foto
Marketing AI, Foto Gabungan Produk AI, video Content Studio) yang sama
sekali tidak tercatat di mana pun.

Dashboard (`/dashboard`) sekarang menjumlah SEMUA sumber biaya (kolom
`total_cost`/`video_cost` untuk Generate/History, `ai_cost_log` untuk
Content Studio) — biaya bulan ini, biaya sepanjang waktu, dan rincian per
fitur. Untuk angka tagihan pasti, tetap rujuk dashboard billing fal.ai
sendiri — aplikasi ini menghitung dari harga publik fal.ai + `usage.cost`
yang mereka laporkan sendiri untuk text-gen, bukan pengganti invoice resmi.

**Penting kalau menambah fitur baru yang manggil fal.ai berbayar:** panggil
`logAiCost({ feature, costUsd, ... })` di tempat yang sama dengan
pemanggilan fal.ai-nya (lihat contoh di `lib/prompts/marketing-photo.ts`
atau `lib/prompts/content-generate.ts`), dan tambahkan feature tag baru ke
`AiCostFeature`/`FEATURE_LABELS` di `lib/cost-log-shared.ts` supaya muncul
rapi di rincian Dashboard. Kalau biaya itu SUDAH tercatat lewat mekanisme
lain (mis. `ai_generation_sets.total_cost`), JANGAN log dobel ke
`ai_cost_log` juga — nanti Dashboard menjumlahnya dua kali. Lihat komentar
di `app/api/content/generate-video/route.ts` untuk contoh kasus nyata
(kenapa `submitVideoClipJob` di `lib/fal/video.ts` sendiri TIDAK
diinstrumen, tapi pemanggilnya di Content Studio DIINSTRUMEN — supaya tidak
dobel-hitung dengan `video_cost` History yang dicatat terpisah).

## Video AI (Kling 3.0 Pro + ffmpeg merge)

Dulu direncanakan "ditunda ke V2" — sekarang sudah live, dipakai di
History/Generate ("video cerita gabungan": tiap foto dianimasikan jadi
klip pendek lalu digabung urut jadi satu video) DAN Content Studio (Reel).
Motion prompt per klip **berbeda tergantung `image_role`** foto sumbernya
(lihat `lib/prompts/video-motion.ts`, `buildRoleMotionPrompt()`) — foto
badan-penuh dapat instruksi model berputar ala lookbook, foto detail
dapat instruksi kamera pan/zoom menelusuri tekstur.

Submit lewat `fal.queue` (async, bukan blocking) supaya progress bisa
dipantau kapan saja termasuk setelah pindah halaman. Kling 3.0 Pro
membatasi `duration` 3-15 detik PER KLIP — total durasi video akhir =
jumlah durasi semua klip.

## Content Studio & Instagram

Halaman `/content` — generate caption + hashtag Instagram (Bahasa Indonesia,
gaya hangat & elegan) dari foto produk yang **sudah ada** di katalog Deera
(`products.image`/`detail`/`warna_images`), plus generate kalender konten
sebulan sekaligus (rotasi produk x 4 tema: highlight produk, tips styling,
brand story, promo — plus tema ke-5 "brand awareness" yang ditambahkan
belakangan). Text-gen pakai `openrouter/router` di fal.ai — **reuse
`FAL_KEY` yang sama**, tidak butuh API key/vendor baru.

Prinsip anti-halusinasi: prompt caption HANYA boleh pakai fakta produk asli
(nama, bahan, warna, harga, ukuran) + catatan tambahan yang admin isi sendiri
(mis. info promo nyata) — AI tidak pernah diinstruksikan mengarang testimoni,
diskon, atau statistik.

Riwayat konten ("Semua Konten" di halaman yang sama) punya **pagination +
search** server-side, sama seperti `/history`.

### Poster AI (konten Instagram "designed", bukan cuma foto polos)

Di panel "Poster AI" (bagian dari step 1 Content Studio), admin bisa minta AI
menyarankan HEADLINE pendek bergaya majalah fashion (2-3 baris besar, boleh 1
baris aksen font tulisan tangan) + subtitle + kalimat caption bar bawah, lalu
me-render itu LANGSUNG DI ATAS foto produk jadi 1 poster PNG siap posting —
logo Deera kecil di kiri atas, headline besar, kode produk, dan swatch warna
opsional (default OFF supaya terasa editorial, bukan flyer katalog).

- Headline/subtitle/bottom caption = copywriting mood/tema dari AI
  (`suggestHeadline()` di `lib/prompts/content-generate.ts`) — tunduk aturan
  anti-halusinasi yang sama, tapi bebas nada emosional/puitis.
- Kode produk & warna yang tersedia (swatch) TIDAK diminta dari AI — diisi
  langsung dari tabel `products` supaya selalu akurat.
- Rendering pakai `next/og` `ImageResponse` (Satori) di
  `lib/image-template/poster.tsx`, hasil PNG di-upload ke Supabase Storage
  (bucket `ai-fashion-studio`, folder `content-posters/`).
- **Logo**: `lib/image-template/assets/logo-mark.png` = file asli dari
  admin, dipakai apa adanya (tanpa badge/shape/recolor), posisi kiri atas.
- **Font**: 3 font asli brand belum bisa dipakai komersial (lisensi
  demo/trial) — sementara diganti font gratis bergaya serupa (Fraunces =
  headline serif, Alex Brush = aksen script, Poppins = teks pendukung),
  file `.ttf` di `lib/image-template/fonts/`.

**Foto Marketing AI** — restyle 1 foto produk yang sudah ada jadi lebih
editorial/lifestyle (`lib/prompts/marketing-photo.ts`,
`generateMarketingPhoto()`), memanggil `fal-ai/nano-banana-pro/edit` yang
SAMA dengan mesin utama Generate/History, tapi dikunci ketat di
wajah/pose/hijab/motif-produk, cuma background/mood/lighting yang berubah
sesuai `sceneIdea` (dari AI via `suggestHeadline()`/`suggestStoryboard()`,
atau admin edit manual). Bisa per-slide untuk carousel.

**Foto Gabungan Produk AI** — generalisasi ke 2-5 produk sekaligus
(`lib/prompts/combo-photo.ts`, `generateComboPhoto()`), menggabungkan
beberapa foto model+produk terpisah jadi SATU frame baru seolah difoto
bersama, dengan storyboard grup (`suggestGroupStoryboard()`) merancang
alur cerita kebersamaan lintas beberapa frame.

**Publish otomatis ke Instagram** (opsional — tanpa ini, Content Studio tetap
penuh fungsi utk generate+edit+jadwalkan, tinggal disalin manual):

1. Punya akun Instagram Professional (Business/Creator) yang terhubung ke
   sebuah Facebook Page.
2. Daftarkan Meta Developer App di [developers.facebook.com](https://developers.facebook.com/),
   minta permission `instagram_business_basic` + `instagram_business_content_publish`.
3. Ajukan **App Review** ke Meta untuk 2 permission di atas — proses di
   pihak Meta, biasanya **2-4 minggu**, di luar kendali aplikasi ini.
4. Setelah disetujui, generate long-lived access token (masa berlaku ~60
   hari, perlu di-refresh berkala secara manual) + catat Instagram Business
   Account ID.
5. Isi di `.env.local`:

   ```
   INSTAGRAM_ACCESS_TOKEN=
   INSTAGRAM_BUSINESS_ACCOUNT_ID=
   ```

Batasan Instagram Graph API yang perlu diketahui: rate limit 25 post
published/24 jam per akun; Reels butuh video asli (bisa dari fitur Video di
atas); Instagram Stories **tidak bisa** dipublish lewat Graph API sama
sekali.

## Yang belum diimplementasi

Lihat PRD §19 (Roadmap) untuk daftar lengkap dan alasannya. Ringkasnya:
batch generate, auto QC AI, integrasi marketplace, multi-user role/approval
workflow, auto-resize multi-format, dan monitoring error terpusat (Sentry
atau setara) — semuanya belum ada, tapi bukan blocker untuk pemakaian
internal saat ini.
