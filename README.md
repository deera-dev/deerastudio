# Deera Studio

Aplikasi internal Deera untuk generate foto katalog gamis pakai AI
(FLUX Virtual Try-On + FLUX Kontext Pro/Nano Banana), pengganti proses foto
studio vendor. Dulu bernama "AI Fashion Studio". Dokumen lengkap: [`docs/PRD-AI-Fashion-Studio.md`](./docs/PRD-AI-Fashion-Studio.md).

## Tech stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase — **project sama dengan Deera** (`deeraindonesia`, project ref
  `khpgjfsaucrhihadnewq`), bukan project baru. Tabel baru pakai prefix `ai_`
  (`ai_models`, `ai_poses`, `ai_background_presets`, `ai_accessory_presets`,
  `ai_generation_sets`, `ai_generations`).
- Fal.ai — FLUX Virtual Try-On (tahap 1, wajib) + FLUX Kontext Pro/Nano
  Banana (tahap 2, default aktif sejak v0.5)
- Cloudinary — hanya untuk gambar final saat publish ke katalog Deera (akun
  Cloudinary Deera yang sama)

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
     > Project Settings > API > service_role key
   - `FAL_KEY` — buat akun di [fal.ai](https://fal.ai/dashboard/keys), isi
     saldo (lihat estimasi biaya di PRD §20)
   - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
     — akun Cloudinary Deera yang sudah ada (sama yang dipakai
     `apps/admin`/`apps/pos` di monorepo Deera)

3. **Apply migration Supabase**

   Migration ada di `supabase/migrations/20260807000000_ai_fashion_studio_init.sql`
   — **belum diapply**. Ini menambah 6 tabel baru ke project Supabase Deera
   yang sedang dipakai app lain (`catalog`/`admin`/`pos`/`finance`), jadi
   sengaja tidak diapply otomatis. Review dulu isinya, lalu apply lewat
   Supabase CLI atau dashboard SQL editor:

   ```bash
   npx supabase link --project-ref khpgjfsaucrhihadnewq
   npx supabase db push
   ```

   Atau paste isi file migration ke SQL Editor di Supabase Dashboard.

4. **Jalankan dev server**

   ```bash
   npm run dev
   ```

   Buka http://localhost:3000

## Struktur folder

```
app/
  login/                    Login (reuse Supabase Auth Deera)
  dashboard/                Statistik ringkas
  models/                   Manajemen model AI (tanpa training)
  poses/                    Foto pose per model (boleh dari arsip vendor lama)
  presets/                  Background & aksesoris preset
  generate/                 Halaman utama generate 1 set foto (Nano Banana Pro, "Opsi B")
  history/                  Riwayat + tombol Publish ke katalog Deera + Tambah Warna Seri
  content/                  Content Studio — caption/hashtag/kalender Instagram + Poster AI (Agustus 2026)
  api/
    generate-set/           POST — generate 1 set foto
    generation-sets/[id]/   GET — detail set; publish/ — POST publish ke katalog; add-seri/ — POST tambah warna ke set yang sudah ada
    generations/[id]/regenerate/  POST — generate ulang 1 gambar
    content/                generate-caption/, generate-calendar/, instagram-status/, suggest-headline/ (Poster AI), render-poster/ (Poster AI)
    content-posts/          POST buat draft; [id]/ — PATCH/DELETE; [id]/publish/ — POST publish ke Instagram

lib/
  supabase/                 Client browser, server, service-role (storage-server.ts: uploadBufferToStorage, dipakai render-poster)
  fal/                      Fal.ai SDK setup — client.ts (foto: Nano Banana Pro/Kontext), text.ts (teks: openrouter/router)
  prompts/                  nano-banana-generate.ts (foto), stage2.ts (crop), background-composer.ts, content-generate.ts (caption + suggestHeadline Poster AI)
  instagram/                Graph API publish wrapper (client.ts) — lihat §Instagram di bawah
  image-template/            poster.tsx (render poster Instagram via next/og ImageResponse), color-map.ts, fonts/, assets/ — lihat §Poster AI di bawah
  cloudinary/                Upload gambar final saat publish

types/database.ts           Tipe TypeScript sesuai skema PRD §12 + ContentPost (Content Studio)
supabase/migrations/        Migration SQL tabel baru (belum diapply, lihat di atas)
docs/PRD-AI-Fashion-Studio.md   PRD lengkap (v0.5) — sumber kebenaran keputusan produk
```

## Content Studio & Instagram

Halaman `/content` — generate caption + hashtag Instagram (Bahasa Indonesia,
gaya hangat & elegan) dari foto produk yang **sudah ada** di katalog Deera
(`products.image`/`detail`/`warna_images`), plus generate kalender konten
sebulan sekaligus (rotasi produk x 4 tema: highlight produk, tips styling,
brand story, promo). Text-gen pakai `openrouter/router` di fal.ai — **reuse
`FAL_KEY` yang sama**, tidak butuh API key/vendor baru.

Prinsip anti-halusinasi: prompt caption HANYA boleh pakai fakta produk asli
(nama, bahan, warna, harga, ukuran) + catatan tambahan yang admin isi sendiri
(mis. info promo nyata) — AI tidak pernah diinstruksikan mengarang testimoni,
diskon, atau statistik.

### Poster AI (konten Instagram "designed", bukan cuma foto polos)

Di panel "Poster AI" (bagian dari step 1 Content Studio), admin bisa minta AI
menyarankan HEADLINE pendek bergaya majalah fashion (2-3 baris besar, boleh 1
baris aksen font tulisan tangan) + subtitle + kalimat caption bar bawah, lalu
me-render itu LANGSUNG DI ATAS foto produk jadi 1 poster PNG siap posting —
logo Deera kecil di kiri atas, headline besar, kode produk, dan swatch warna
opsional. Defaultnya MINIMAL (foto + headline + subtitle saja, kode produk &
swatch warna OFF by default) supaya hasilnya terasa editorial/lifestyle,
bukan flyer katalog — admin tinggal nyalain toggle-nya kalau post itu memang
perlu info lengkap. Hasil render bisa dipakai langsung sebagai foto post
(menggantikan foto polos) sebelum generate caption.

- Headline/subtitle/bottom caption = copywriting mood/tema dari AI (lihat
  `suggestHeadline()` di `lib/prompts/content-generate.ts`) — tunduk aturan
  anti-halusinasi yang sama (tidak boleh mengarang bahan/harga/diskon/
  testimoni), tapi bebas nada emosional/puitis karena ini bukan klaim fakta.
- Kode produk & warna yang tersedia (swatch) TIDAK diminta dari AI — diisi
  langsung dari tabel `products` di `app/api/content/suggest-headline/route.ts`
  supaya selalu akurat.
- Rendering pakai `next/og` `ImageResponse` (Satori) di
  `lib/image-template/poster.tsx`, hasil PNG di-upload ke Supabase Storage
  (bucket `ai-fashion-studio`, folder `content-posters/`) lewat
  `uploadBufferToStorage()`.
- **Logo**: `lib/image-template/assets/logo-mark.png` = file `deera-white.png`
  asli dari admin, di-crop APA ADANYA — tanpa badge/card/shape apa pun di
  belakangnya, tanpa recolor. Ditaruh kiri atas (bukan tengah/bawah — sudah
  dicoba beberapa versi bentuk badge custom, admin akhirnya minta logo polos
  saja biar dijamin 100% sama persis dengan file asli, lihat riwayat chat).
  Bagian siluet rusa di file aslinya itu LUBANG transparan (bukan solid) —
  sengaja dibiarkan apa adanya sehingga foto di baliknya "mengintip" lewat
  siluet itu (efek jendela), bukan bug. Kalau logo resmi berubah, tinggal
  timpa file ini dengan crop baru dari file yang dikirim admin — TIDAK perlu
  proses recolor/fill-hole apa pun lagi (pattern lama yang butuh
  `scipy.ndimage.binary_closing`/`binary_fill_holes` sudah tidak dipakai
  sejak versi ini).
- **Font**: 3 font asli brand (dikirim admin) berlisensi Demo/Trial atau
  Personal-Use-Only, belum bisa dipakai komersial — sementara diganti font
  gratis bergaya serupa (Fraunces = headline serif, Alex Brush = aksen
  script, Poppins = teks pendukung), file `.ttf` di
  `lib/image-template/fonts/`. Kalau nanti admin beli lisensi font asli,
  tinggal ganti file `.ttf` di folder itu — struktur render tidak perlu
  diubah.
- Warna swatch dipetakan dari nama warna Indonesia (`products.warna`) ke hex
  approx lewat `lib/image-template/color-map.ts` — dekoratif saja, fallback
  abu netral kalau nama warna tidak dikenali.

**Foto Marketing AI** (bagian dari panel Poster AI) — beda dari "foto
produk" (foto katalog apa adanya, dipakai di halaman `/generate` &
`/history`), fitur ini men-generate ULANG foto produk yang SUDAH ADA jadi
lebih editorial/lifestyle (mis. di ruang tamu dengan cahaya sore, bukan
studio polos), khusus untuk konten Instagram:

- AI social media specialist menyarankan `sceneIdea` (deskripsi
  scene/lighting/props singkat dalam Bahasa Inggris, bagian dari respons
  `suggestHeadline()` yang sama dengan headline poster) — admin bisa edit
  dulu sebelum generate.
- `lib/prompts/marketing-photo.ts` (`generateMarketingPhoto()`) memanggil
  `fal-ai/nano-banana-pro/edit` yang SAMA dengan mesin utama
  (`nano-banana-generate.ts`), TAPI cuma dikasih 1 foto sumber + instruksi
  "kunci wajah/pose/hijab/motif-produk 100% identik, ganti HANYA
  background/lighting/props di sekitar model" — polanya mengikuti gaya
  fidelity-lock yang sama dgn `IDENTITY_LOCK_ONLY` di `stage2.ts`.
  Endpoint: `POST /api/content/generate-marketing-photo`.
- Hasil fal.ai (URL sementara) di-fetch lalu di-upload ulang ke Supabase
  Storage (folder `content-marketing-photos/`) supaya URL-nya permanen.
- Kalau admin generate foto marketing, poster (badge+headline dst) di-render
  DI ATAS foto hasil AI ini, bukan foto katalog polos — lihat
  `handleRenderPoster()` di `app/content/page.tsx`.

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
published/24 jam per akun; Reels butuh `products.video` asli (bukan foto);
Instagram Stories **tidak bisa** dipublish lewat Graph API sama sekali.

## Yang belum diimplementasi (lanjutan build)

Ini scaffold awal — halaman-halaman di atas masih stub UI + komentar TODO.
Yang masih perlu dikerjakan sebelum MVP siap pakai (lihat PRD §19 roadmap V1):

- Form & UI lengkap tiap halaman (saat ini baru kerangka)
- Auth guard (middleware redirect ke /login kalau belum login)
- Upload foto ke Supabase Storage dari browser (drag & drop dsb)
- Isi 15-20+ background preset (PRD §12 catatan v0.5) — pekerjaan konten,
  bukan cuma engineering
- Kurasi elemen `MATERIALS`/`MOODS`/`SETTINGS` di
  `lib/prompts/background-composer.ts` sesuai selera brand Deera
- Testing end-to-end alur generate dengan foto model & produk asli
- Pertimbangkan queue worker kalau deploy ke Vercel (lihat catatan di
  `app/api/generate-set/route.ts` soal timeout serverless)
