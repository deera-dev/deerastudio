# PRD — Deera Studio (dulu "AI Fashion Studio")

**Versi:** 1.0 (mencerminkan implementasi yang sudah LIVE, dipakai internal)
**Tanggal:** 9 Agustus 2026
**Owner:** Denny Angesti Pratama
**Status:** Implemented — dipakai sehari-hari oleh tim Deera, bukan lagi draft

> **CATATAN PENTING SEBELUM BACA LEBIH JAUH:** dokumen ini pernah ditulis
> sebagai PRD *sebelum* development (v0.1–v0.5, riwayatnya diarsipkan di
> §22 "Riwayat Keputusan"), dan sejak itu produknya **berpindah arsitektur
> beberapa kali** selama development berjalan. Seluruh isi dokumen ini
> (§1–§21) sudah ditulis ulang per 9 Agustus 2026 untuk mencerminkan
> **apa yang sungguh-sungguh berjalan hari ini**, bukan rencana awal.
> Kalau butuh alasan/proses di balik sebuah keputusan desain, cek §22 dan
> riwayat chat — dokumen utama di bawah ini sengaja ditulis sebagai
> "keadaan sekarang", bukan jurnal perubahan.
>
> **Tiga pivot terbesar dari rencana awal:**
> 1. **Mesin AI**: bukan lagi FLUX Virtual Try-On + FLUX Kontext Pro
>    (2 tahap terpisah) — sekarang **satu pemanggilan Nano Banana Pro**
>    (`fal-ai/nano-banana-pro/edit`, Gemini 3 Pro Image) yang sekaligus
>    memakaikan produk, mengatur background, dan aksesoris dalam satu
>    generate. Terbukti jauh lebih akurat menjaga motif/tekstur produk
>    lewat tes manual pemilik brand. Lihat §9.
> 2. **Video AI**: semula "Out of Scope, ditunda ke V2" — sekarang **sudah
>    live di V1**, baik di History/Generate ("video cerita gabungan": tiap
>    foto dianimasikan lalu digabung jadi satu video) maupun di Content
>    Studio (Reel Instagram). Lihat §7.8.
> 3. **Content Studio ditambahkan**: fitur baru yang sama sekali tidak ada
>    di rencana awal — generate caption/hashtag Instagram, poster
>    bertipografi, "Foto Marketing AI" (restyle scene), "Foto Gabungan
>    Produk AI" (gabung 2-5 model dalam 1 frame), dan publish langsung ke
>    Instagram lewat Graph API. Lihat §7.9.
>
> Desain visual juga berubah total: dari rencana "light mode, warna brand
> gold" menjadi **dark glassmorphism** (kaca gelap, blur, aksen gold) —
> lihat §14.

---

# 1. Ringkasan Produk

Deera Studio adalah aplikasi web internal untuk menghasilkan **foto dan
video katalog** gamis/mukena secara otomatis menggunakan AI, sebagai
pengganti sebagian besar proses foto studio konvensional dengan vendor
(studio + model + fotografer + editor), DAN sebagai mesin pembuat konten
marketing Instagram (caption, poster, foto editorial, video Reel).

Alur inti (Generate/History — lihat §7.6): admin upload foto produk
**raw flat-lay** (gamis difoto rata tanpa model, beberapa sudut/detail) →
sistem memanggil **satu model AI** (Nano Banana Pro) dengan foto model
referensi + SEMUA foto produk + instruksi teks sekaligus → hasilnya foto
model memakai produk itu, dengan background & aksesoris sesuai pilihan,
dalam **satu pemanggilan**, sambil menjaga detail kain/bordir/motif/
siluet produk **identik dengan aslinya**.

Sebagai perluasan (Content Studio — lihat §7.9), admin juga bisa
menghasilkan konten Instagram siap posting dari foto yang **sudah ada** di
katalog (bukan generate ulang dari nol): caption+hashtag, poster
bertipografi (headline gaya majalah fashion di atas foto), restyle foto
jadi lebih editorial/lifestyle ("Foto Marketing AI"), gabungan beberapa
model dalam satu frame ("Foto Gabungan Produk AI"), dan video pendek dari
foto-foto itu — semuanya bisa langsung dipublish ke Instagram.

Tujuan utama:
* Mengurangi biaya foto studio vendor.
* Mempercepat produksi katalog & konten marketing.
* Menjaga konsistensi model, pose, dan kualitas visual.
* Mempertahankan detail produk semaksimal mungkin — ini adalah **syarat
  mutlak**, bukan preferensi.
* Biaya AI tercatat akurat & transparan (lihat §18, §20) — bukan cuma
  estimasi kasar.

---

# 2. Latar Belakang

Sebelum ada Deera Studio, pembuatan foto katalog Deera menggunakan vendor
eksternal — studio, model, dan fotografer mereka. Untuk brand dengan
banyak SKU, proses ini lambat, mahal, dan sulit dijadwalkan ulang setiap
ada produk baru. Konten marketing Instagram juga dibuat manual (foto studio
dipakai apa adanya, caption ditulis manual).

Deera Studio jadi mesin produksi katalog **dan** konten marketing berbasis
AI: input-nya foto produk flat-lay yang sudah rutin dikerjakan tim
internal, output-nya adalah **set foto siap upload** ke marketplace/website
DAN **konten Instagram siap posting** — tanpa tergantung jadwal vendor
atau kemampuan menulis copy marketing.

---

# 3. Tujuan Bisnis

Target awal MVP (§3 versi lama) memakai proyeksi harga FLUX VTO+Kontext
yang sudah tidak relevan sejak pivot ke Nano Banana Pro (§9). Angka biaya
aktual & kapasitas real per fitur ada di §20 — ringkasnya:

* Foto katalog per SKU (foto utama + foto detail + foto angle tambahan
  opsional) **selesai dalam hitungan menit**, bukan menunggu jadwal
  vendor.
* Biaya nyata per foto ~Rp 2.700 (Nano Banana Pro, generate penuh) atau
  ~Rp 640 (Kontext, cuma crop detail dari foto yang sudah ada) — jauh
  lebih murah dari sesi foto studio vendor per SKU.
* Sejak Agustus 2026, **semua biaya AI (foto, video, teks Content
  Studio) tercatat otomatis** lewat `ai_cost_log` (§18) dan tampil di
  Dashboard (§14) — bukan lagi estimasi kasar per bulan seperti
  rencana awal, tapi angka riil per panggilan API.
* Video & Content Studio menambah kapasitas biaya bulanan (di luar
  proyeksi awal yang cuma menghitung foto) — lihat §20 untuk rincian
  per fitur.

---

# 4. Scope (Implemented)

## Sudah Live

* Login admin (reuse Supabase Auth Deera, akun `@deera.id` yang sama
  dengan admin.deera.id).
* Manajemen model AI (foto referensi, tanpa training).
* Manajemen pose per model (foto referensi, boleh dari arsip vendor lama).
* Manajemen preset background & aksesoris, dengan gambar referensi &
  kemampuan edit (termasuk tambah/ganti gambar preview) — lihat §7.4.
* Upload produk (foto flat-lay: depan, belakang, dan 6 slot detail
  opsional — dada, leher, lengan, **tangan/manset**, kelim, badan penuh).
* **Generate satu set foto per produk** dalam satu pemanggilan Nano Banana
  Pro per gambar: 1 foto utama (wajib), N foto "angle lain" (pose berbeda,
  opsional, jumlah diatur admin), N foto "detail" (crop close-up,
  diturunkan dari foto utama lewat Kontext, murah), dan N foto "seri"
  (varian warna lain dari produk yang sama, masing-masing digenerate
  penuh dari 1 foto asli per warna yang diupload admin).
* Publish hasil terpilih ke katalog Deera (`products.image`/`detail`/
  `warna_images`) lewat Cloudinary.
* **Video "cerita gabungan"** (History/Generate) — semua foto hasil
  generate yang dipilih admin dianimasikan jadi klip pendek (motion
  berbeda tergantung apakah foto itu badan-penuh atau close-up detail),
  lalu digabung urut jadi satu video utuh. Lihat §7.8.
* **Content Studio** (`/content`) — generate caption+hashtag, poster
  bertipografi, restyle foto ("Foto Marketing AI"), gabungan multi-produk
  ("Foto Gabungan Produk AI"), video Reel, kalender konten bulanan, dan
  publish otomatis ke Instagram lewat Graph API. Lihat §7.9.
* Pencatatan biaya AI terpusat (`ai_cost_log`) + Dashboard dengan
  rincian biaya per fitur, biaya bulan ini vs sepanjang waktu, dan daftar
  item yang gagal/perlu perhatian. Lihat §14, §18.
* Riwayat generate dengan **pagination + search** (server-side, bukan
  cuma limit 50 tanpa filter seperti versi awal).

## Belum Diimplementasi (tetap di roadmap, lihat §19)

* Batch generate (generate banyak SKU sekaligus dalam satu antrian).
* Auto QC AI (deteksi otomatis kualitas hasil sebelum ditampilkan ke
  admin).
* Integrasi marketplace (auto-upload ke Shopee/Tokopedia dll).
* Multi-user role (approval workflow, role reviewer terpisah).
* Mobile app native (web app sudah responsive mobile).
* Auto-resize ke berbagai format marketplace.
* Monitoring/error-tracking terpusat (Sentry dsb) — saat ini error cukup
  ditangkap & ditampilkan ke admin (toast) + `console.error` di server,
  belum ada dashboard monitoring eksternal.

---

# 5. Persona Pengguna

## Admin Brand

* Mengelola model AI, pose, dan preset background/aksesoris.
* Melakukan generate set foto & video katalog.
* Mengelola Content Studio: generate & publish konten Instagram.
* Memantau biaya AI lewat Dashboard.

## Tim Konten

* Upload produk baru (foto flat-lay).
* Memilih background/aksesoris saat generate.
* Generate & jadwalkan konten Instagram dari produk yang sudah ada di
  katalog.
* Mengunduh hasil / publish ke katalog & Instagram.

---

# 6. User Journey

## A. Foto & video katalog (Generate/History)

1. Login (`/login`, auto-suffix `@deera.id`).
2. **(Setup awal, sekali per model)** Buka `/models` → buat entri model →
   buka `/poses`, upload beberapa foto pose untuk model itu.
3. Buka `/generate`. Pilih produk dari katalog Deera (browse dengan
   gambar, bukan input kode manual), pilih model, pilih pose utama +
   opsional pose "angle lain" tambahan, pilih background (preset atau
   custom), pilih aksesoris.
4. Upload foto flat-lay produk (depan wajib, sisanya opsional termasuk
   slot **Detail Tangan** yang terpisah dari Detail Lengan).
5. Atur jumlah foto detail & seri yang mau digenerate (kontrol biaya).
6. Klik **Generate Set** — sistem memanggil Nano Banana Pro per foto
   utama/angle/seri, dan Kontext untuk tiap foto detail (crop dari foto
   utama). Status per gambar terlihat real-time.
7. Hasil set foto muncul. Admin review, generate ulang gambar tertentu
   kalau belum pas.
8. **(Opsional)** Klik "Generate Video" — semua foto terpilih diurutkan
   sesuai cerita yang diinginkan, dianimasikan jadi klip, digabung jadi
   satu video, dengan progress bisa dipantau kapan saja (termasuk setelah
   pindah halaman lalu balik lagi).
9. Klik **Publish** untuk push hasil terpilih ke `products.image`/
   `detail`/`warna_images` — langsung muncul di catalog.deera.id.

## B. Konten Instagram (Content Studio)

1. Buka `/content`. Pilih 1-5 produk yang sudah ada di katalog (foto
   sudah pernah dipublish dari alur A, atau foto asli produk).
2. Pilih tema (highlight produk, tips styling, brand story, promo, atau
   brand awareness) dan tipe konten (feed 1 foto, carousel, atau reel).
3. **(Opsional)** Panel Poster AI: minta AI menyarankan headline/subtitle/
   caption bar bawah + arahan scene, generate "Foto Marketing AI" (restyle
   1 foto jadi lebih editorial) atau "Foto Gabungan Produk AI" (kalau
   pilih 2-5 produk sekaligus), lalu render poster bertipografi di atas
   hasilnya.
4. Generate caption + hashtag dari data produk asli (anti-halusinasi —
   AI tidak boleh mengarang fakta produk).
5. **(Kalau reel)** Generate video dari foto-foto yang dipilih.
6. Simpan sebagai draft, jadwalkan (`scheduled_at`), atau publish
   langsung ke Instagram (kalau sudah setup Graph API, lihat README).

---

# 7. Functional Requirements

## 7.1 Authentication

* Login email + password, reuse Supabase Auth Deera (project sama,
  akun `@deera.id` yang sama dengan admin.deera.id).
* Route protection via `middleware.ts` + `ProtectedRoute` — redirect ke
  `/login` kalau belum autentikasi.

## 7.2 Model Management

Tanpa training — foto referensi model dipakai langsung sebagai salah
satu `image_urls` di panggilan Nano Banana Pro tiap generate.

### Fields (`ai_models`)
id, name, thumbnail_url, is_active, created_at.

### Actions
Create, Update (termasuk edit inline dari halaman `/models`), Delete,
Activate/Deactivate.

## 7.3 Pose Management

Pose terikat ke `model_id` tertentu — satu "pose" adalah foto sungguhan
dari model itu dalam pose tersebut, dipakai sebagai salah satu foto
referensi identitas di panggilan Nano Banana Pro (§9).

### Fields (`ai_poses`)
id, model_id, name, reference_image_url, description, is_active,
created_at.

### Actions
Upload (terikat ke satu model), edit inline, delete, activate/deactivate.
Dipilih di `/generate` lewat grid gambar (bukan dropdown teks).

## 7.4 Background & Accessory

Preset dikurasi manual oleh admin, masing-masing dengan gambar referensi
opsional yang sekarang **bisa diedit setelah dibuat** (tombol Edit per
kartu, termasuk ganti gambar) — sebelumnya preset lama yang dibuat tanpa
gambar tidak punya cara ditambahkan gambarnya belakangan; sudah diperbaiki.

Form tambah preset (`/presets`) memakai layout upload-di-kiri + field-di-
kanan (flex-between), bukan dropzone raksasa yang mendominasi form seperti
versi awal.

### Fields — `ai_background_presets`
id, name, prompt_fragment, reference_image_url, mood_tags (jsonb),
warna_affinity (jsonb), cocok_untuk_kategori (jsonb), last_used_at,
use_count, is_active, created_at.

### Fields — `ai_accessory_presets`
id, category (`tas`|`kalung`|`cincin`|`anting`), name, prompt_fragment,
reference_image_url, is_active, created_at.

Kerudung & heels **tidak** punya tabel preset — warnanya otomatis
mengikuti `products.warna` lewat instruksi teks di prompt Nano Banana
Pro, tanpa pilihan gaya.

### Actions
CRUD standar + edit inline gambar/field per kartu preset. Thumbnail
preset ditampilkan di halaman Generate supaya admin bisa lihat kira-kira
bentuknya sebelum memilih (sebelumnya cuma pill teks tanpa gambar).

## 7.5 Product Upload

### Minimum
Foto depan (flat-lay).

### Optional (6 slot detail)
Foto belakang, badan penuh, detail dada, detail leher, detail lengan
(bahu/lengan atas), **detail tangan** (manset/pergelangan tangan — SLOT
TERPISAH dari detail lengan, ditambahkan Agustus 2026 karena keduanya
area yang jelas berbeda secara visual).

### Validasi
JPG/PNG/WebP, upload lewat dropzone (`react-dropzone`) langsung ke
Supabase Storage dari browser — tidak ada lagi ketergantungan pada
naming convention file lokal seperti rencana awal (§23 lama sudah usang).

## 7.6 Generate Photo Set

**Arsitektur final ("Opsi B"):** SATU pemanggilan Nano Banana Pro per
foto utama/angle/seri (bukan dua tahap VTO+Kontext terpisah seperti
rencana awal). Kontext tetap dipakai, tapi HANYA untuk foto "detail"
(crop/zoom murni dari foto utama yang sudah jadi — bukan re-render
produk dari nol), karena operasi reframe itu murah & tidak butuh model
sekuat Nano Banana Pro.

### Input
model_id, pose_id (utama) + anglePoseIds (opsional, array pose tambahan
untuk foto "angle lain"), background_mode (`auto`|`preset`|
`ai_improvised`), background_preset_id, accessory_preset_ids,
product_images (front + hingga 7 slot opsional termasuk detailHand),
product_warna, jumlah foto detail & seri yang diinginkan.

### Peran tiap image_role (lihat `types/database.ts`)
* `utama` — foto badan penuh, pose utama. Full pass Nano Banana Pro.
* `angle` — foto badan penuh, pose LAIN dari model yang sama (generate
  independen, full pass Nano Banana Pro juga).
* `detail` — crop close-up (kerah/lengan/bordir), DITURUNKAN dari foto
  utama via Kontext (murah, ~Rp 640/foto vs ~Rp 2.700/foto full pass).
* `seri` — varian WARNA lain dari produk yang sama. Bukan lagi recolor
  tebakan AI dari foto utama — admin upload SATU foto full-body asli per
  warna varian (`variant_product_images`), lalu digenerate FULL & independen
  lewat Nano Banana Pro dengan pose sama seperti utama, sambil reuse foto
  warna utama sebagai referensi bentuk/tekstur/bordir.

### Prompt Nano Banana Pro (garis besar, lihat `lib/prompts/nano-banana-generate.ts`)
Dikirim: foto pose target, 1-2 foto pose LAIN dari model yang sama
(penguat identitas), SEMUA foto produk yang diupload apa adanya (tanpa
compositing), deskripsi background (dari preset atau AI improvisasi),
instruksi warna kerudung/heels ikut `productWarna`, fragment aksesoris
terpilih. Instruksi eksplisit menjaga wajah/identitas model dan
detail/tekstur/motif produk **identik**, sambil bebas menyesuaikan
pose/framing sesuai kebutuhan foto.

### Output — per gambar (`ai_generations`)
output_image_url, vto_image_url (kolom lama, sekarang diisi sama dengan
output_image_url karena tidak ada lagi tahap terpisah), has_stage2,
status, image_role, generation_time_ms, cost, error_message,
video_url/video_status/video_cost (opsional, lihat §7.8).

## 7.7 Generation History

`/history` — dikelompokkan per **photo set** (`ai_generation_sets`),
dengan **pagination server-side (10/halaman) + search kode produk**
(server-side `.ilike()`/`.range()`, bukan lagi `.limit(50)` client-side
tanpa filter seperti versi awal yang bikin riwayat lama "hilang" dari
tampilan).

Tiap set menampilkan: tanggal, model, pose, produk, status keseluruhan
(`queued`/`processing`/`completed`/`partial`/`failed`), thumbnail semua
hasil, biaya generate, dan status video (kalau pernah diminta).

Admin bisa generate ulang gambar tertentu, tambah warna seri baru tanpa
mengulang seluruh set, dan generate/publish video cerita gabungan.

## 7.8 Video Generation (BARU — sebelumnya Out of Scope MVP)

Dipakai di History/Generate (per set foto) DAN Content Studio (per post,
khusus tipe "reel"). Model: Kling 3.0 Pro image-to-video
(`fal-ai/kling-video/v3/pro/image-to-video`).

### Alur
1. Admin pilih foto-foto mana saja (urut sesuai cerita yang diinginkan)
   dan durasi per klip (3-15 detik, default 5).
2. Tiap foto disubmit sebagai 1 job klip terpisah lewat `fal.queue`
   (async, bukan blocking) — supaya progress asli bisa dipantau dan
   admin bisa pindah halaman lalu kembali tanpa kehilangan progress.
3. Tiap klip dianimasikan dengan **motion prompt berbeda tergantung
   `image_role`** foto sumbernya (§7.6): foto badan-penuh (utama/angle/
   seri) dapat instruksi "model berputar anggun ala lookbook", foto
   detail dapat instruksi "kamera pan/zoom pelan menelusuri tekstur" —
   BUKAN lagi satu motion prompt yang sama dipaksakan ke semua klip
   (masalah versi awal: instruksi "kain bergoyang" yang pas untuk foto
   badan penuh terasa aneh dipakai apa adanya di foto close-up kancing).
4. Setelah semua klip selesai, digabung URUT jadi satu video utuh lewat
   `fal-ai/ffmpeg-api/merge-videos` (gratis, operasi ffmpeg murni bukan
   model AI).
5. Hasil akhir disimpan (`ai_generation_sets.video_url` untuk History,
   dikembalikan ke client apa adanya untuk Content Studio karena draft
   yang belum disimpan tidak punya baris DB permanen).

### Batasan
Kling 3.0 Pro membatasi `duration` 3-15 detik PER KLIP (bukan per video
gabungan) — total durasi video akhir = jumlah durasi semua klip. Tanpa
audio (`generate_audio: false`, sesuai permintaan admin).

## 7.9 Content Studio (BARU — tidak ada di rencana awal)

`/content` — generate konten marketing Instagram dari foto produk yang
**sudah ada** di katalog Deera (bukan generate ulang dari nol).

### Fitur
* **Caption + hashtag** — `generateCaption()`, 5 tema (highlight produk,
  tips styling, brand story, promo, brand awareness), gaya storytelling
  bukan copy jualan keras. Anti-halusinasi ketat: hanya boleh pakai fakta
  produk yang benar-benar dikirim.
* **Poster AI** — AI menyarankan headline pendek gaya majalah fashion
  (`suggestHeadline()`) + subtitle + caption bar bawah + arahan scene,
  di-render langsung di atas foto jadi 1 poster PNG (`next/og`
  `ImageResponse`, font Fraunces/Alex Brush/Poppins, logo Deera asli di
  kiri atas, warna swatch opsional).
* **Foto Marketing AI** — restyle 1 foto produk yang sudah ada jadi lebih
  editorial/lifestyle (`generateMarketingPhoto()`, Nano Banana Pro edit,
  $0.15/panggilan) — wajah/pose/garment dikunci ketat, background/mood
  yang berubah sesuai `sceneIdea` dari AI atau admin. Bisa per-slide untuk
  carousel, dengan storyboard AI (`suggestStoryboard()`) yang merancang
  alur cerita lintas slide supaya tidak terasa acak.
* **Foto Gabungan Produk AI** — generalisasi ke 2-5 produk sekaligus
  (`generateComboPhoto()`), menggabungkan beberapa foto model+produk yang
  terpisah jadi SATU frame baru seolah difoto bersama. Storyboard grup
  (`suggestGroupStoryboard()`) merancang alur cerita kebersamaan lintas
  beberapa frame.
* **Video Reel** — sama seperti §7.8, tapi stateless (progress disimpan
  di state client sampai admin klik "Simpan Draft").
* **Kalender konten** — generate rencana beberapa post sekaligus, rotasi
  produk x tema.
* **Publish ke Instagram** — lewat Graph API (`lib/instagram/client.ts`),
  butuh akun Instagram Professional + Meta Developer App + App Review
  (proses Meta, di luar kendali aplikasi ini, lihat README). Rate limit
  25 post/24 jam, Reels butuh video asli, Stories tidak bisa dipublish
  lewat Graph API.
* **Riwayat konten** (`/content`, panel "Semua Konten") — **pagination +
  search** server-side, sama seperti History (§7.7).

### Fields (`content_posts`)
id, product_kode, secondary_product_kodes (jsonb, untuk mode grup),
image_urls, content_type, theme, caption, hashtags, extra_notes,
scheduled_at, status (`draft`|`scheduled`|`published`|`failed`),
instagram_media_id, published_at, error_message, video_url, created_at.

---

# 8. Non-Functional Requirements

| Item          | Target                    |
| ------------- | ------------------------- |
| Response UI   | < 300 ms                  |
| Generate 1 foto (Nano Banana Pro, full pass) | ~10-30 detik (satu pemanggilan, bukan lagi 2 tahap terpisah) |
| Generate 1 foto detail (Kontext, crop) | ~5-15 detik |
| Generate 1 klip video (Kling, per klip 3-15 detik) | ~30-90 detik (async via queue, tidak blocking) |
| Generate set foto lengkap | 1-5 menit tergantung jumlah gambar diminta |
| Availability  | 99%                       |
| Storage       | Supabase Storage (kerja) + Cloudinary (final, setelah publish) |
| Security      | Authenticated access only |

---

# 9. AI Pipeline

## Provider — Fal.ai (satu-satunya provider), beberapa model berbeda peran

1. **Nano Banana Pro** (`fal-ai/nano-banana-pro/edit`, Gemini 3 Pro
   Image) — **mesin utama**, dipakai untuk foto `utama`/`angle`/`seri`
   (§7.6). Menerima BANYAK foto referensi sekaligus (`image_urls: string[]`)
   + 1 prompt bebas — pola ini yang terbukti di tes manual pemilik brand
   jauh lebih akurat menjaga motif/tekstur produk dibanding model VTO
   sempit (FLUX VTO/FASHN) yang cuma menerima 2 foto tanpa instruksi teks
   bebas. Menggantikan pipeline lama FLUX VTO (tahap 1) + FLUX Kontext Pro
   (tahap 2).
2. **FLUX Kontext Pro** (`fal-ai/flux-pro/kontext`) — HANYA untuk foto
   `detail` (crop/zoom murni dari foto utama yang sudah jadi, bukan
   re-render dari nol) — operasi murah & cukup untuk reframe.
3. **Kling 3.0 Pro** (`fal-ai/kling-video/v3/pro/image-to-video`) — video
   image-to-video, per klip (§7.8).
4. **fal-ai/ffmpeg-api/merge-videos** — gabung klip video jadi satu file
   (gratis, operasi ffmpeg murni).
5. **openrouter/router** (model `anthropic/claude-sonnet-4.5`) — text-gen
   Content Studio (caption, headline, storyboard, motion note). Endpoint
   pengganti `fal-ai/any-llm` yang sudah deprecated per dokumentasi
   fal.ai. Reuse `FAL_KEY` yang sama, tidak butuh vendor/API key baru.

> Model lama `fal-ai/fashn/tryon/v1.6` (FASHN VTO, sempat dipakai sebagai
> pengganti FLUX VTO sebelum pivot ke Nano Banana Pro) masih ada di
> `FAL_MODELS` sebagai referensi/kemungkinan fallback, TIDAK dipakai lagi
> di pipeline aktif manapun.

## Cara Kerja (Generate Foto)

```
Upload foto (browser) → Supabase Storage
        |
        v
Next.js Route Handler (POST /api/generate-set)
        |
        v
Server tentukan background (mode Auto: preset atau AI-improvised,
komposisi teks murni, tanpa panggilan LLM tambahan)
        |
        v
Untuk tiap foto utama/angle/seri:
  Panggil Nano Banana Pro (foto model + SEMUA foto produk + prompt)
Untuk tiap foto detail:
  Panggil Kontext (crop dari foto utama yang sudah selesai)
        |
        v
Fal.ai memproses di server cloud mereka
        |
        v
Simpan URL ke Supabase Storage + catat di ai_generations/ai_generation_sets
        |
        v
Tampilkan ke admin (status per-gambar real-time)
        |
        v
(opsional) Generate video — lihat §7.8
        |
        v
(setelah admin approve) Publish → update products.image/detail/warna_images
```

## Cara Kerja (Video)

```
Admin pilih foto + urutan cerita
        |
        v
Submit 1 job Kling per foto (fal.queue.submit, async)
        |
        v
Polling status tiap klip (queued/processing/completed/failed)
        |
        v
Semua klip selesai → submit job merge-videos (URUT sesuai array)
        |
        v
Polling status merge
        |
        v
Video final tersimpan (History: ai_generation_sets.video_url;
Content Studio: dikembalikan ke client, disimpan saat draft di-save)
```

---

# 10. System Architecture

Tabel baru Deera Studio (prefix `ai_`) ditambahkan ke **project Supabase
Deera yang sudah ada** (project ref `khpgjfsaucrhihadnewq`, sama dengan
`catalog`/`admin`/`pos`/`finance`) — bukan project terpisah. Ini
memungkinkan `ai_generation_sets.product_kode` jadi foreign key asli ke
`products.kode`, dan hasil generate yang di-approve admin dipush langsung
mengisi `products.image`/`detail`/`warna_images`, muncul otomatis di
catalog.deera.id tanpa perubahan kode di app itu.

```text
Next.js 15 App Router (Deera Studio) — dark glassmorphism UI
        |
        v
Route Handler / Server Action
        |
        +---> Supabase Database — PROJECT SAMA DENGAN DEERA
        |      ├─ tabel existing: products, stok_warna, sales, dst (dibaca/ditulis saat publish)
        |      └─ tabel baru (prefix ai_): ai_models, ai_poses,
        |         ai_background_presets, ai_accessory_presets,
        |         ai_generation_sets, ai_generations, ai_cost_log
        |         + content_posts (Content Studio, tanpa prefix ai_)
        |
        +---> Supabase Storage (bucket "ai-fashion-studio", terpisah dari
        |      folder produk Deera yang sudah ada)
        |
        v
Fal.ai API
   +-- Nano Banana Pro edit (foto utama/angle/seri, Content Studio marketing/combo photo)
   +-- FLUX Kontext Pro (foto detail crop)
   +-- Kling 3.0 Pro (video per klip)
   +-- ffmpeg-api/merge-videos (gabung video)
   +-- openrouter/router (text-gen Content Studio)
        |
        v
Hasil (gambar/video) → Supabase Storage (kerja) atau langsung URL fal.ai
        |
        v
(setelah admin approve) Publish → Cloudinary → update products.*
        |                Instagram Graph API → publish content_posts
        v
catalog.deera.id (foto)     Instagram (konten)
```

---

# 11. Tech Stack

## Frontend
* Next.js 15 (App Router) + TypeScript
* Tailwind CSS v4
* Desain sistem custom dark glassmorphism (bukan shadcn/ui seperti
  rencana awal — komponen UI ditulis sendiri di `components/ui/`)
* framer-motion (animasi), lucide-react (ikon), sonner (toast),
  react-dropzone (upload gambar)

## Backend
* Next.js Route Handlers (semua endpoint `/api/*`)

## Database
* Supabase Postgres — project sama dengan Deera (§10)

## Storage
* Supabase Storage (bucket `ai-fashion-studio`) — file kerja & hasil
  generate sebelum publish
* Cloudinary — gambar final setelah publish ke katalog (akun Deera yang
  sama dipakai `apps/admin`/`apps/pos`)

## AI
* Fal.ai SDK (`@fal-ai/client`) — lihat §9 untuk daftar model

## Integrasi lain
* Instagram Graph API (`lib/instagram/client.ts`) — publish konten
  Content Studio

---

# 12. Database Schema

Semua tabel di bawah ini ada di **project Supabase Deera yang sudah ada**
(§10). Tabel `products`, `stok_warna`, dst dari Deera **tidak diubah
strukturnya**, hanya dibaca — kecuali `products.image`/`detail`/
`warna_images` yang ditulis balik saat publish (§15).

> Catatan implementasi: skema live sudah berkembang lebih jauh dari file
> migration tunggal yang ada di `supabase/migrations/` (lihat README) —
> perubahan-perubahan berikutnya (kolom video, `content_posts`,
> `ai_cost_log`, `product_images.detailHand`, dst) diterapkan langsung ke
> project lewat migration terpisah yang belum semuanya di-export jadi
> file lokal. Kalau setup project baru dari nol, jangan cuma andalkan
> migration SQL awal — cek `types/database.ts` sebagai sumber kebenaran
> struktur data terkini, atau tarik skema live lewat Supabase CLI/dashboard.

## ai_models

```sql
create table ai_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  thumbnail_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## ai_poses

```sql
create table ai_poses (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references ai_models(id) not null,
  name text not null,
  reference_image_url text not null,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## ai_background_presets

```sql
create table ai_background_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt_fragment text not null,
  reference_image_url text,
  mood_tags jsonb default '[]',
  warna_affinity jsonb default '[]',
  cocok_untuk_kategori jsonb default '[]',
  last_used_at timestamptz,
  use_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## ai_accessory_presets

```sql
create table ai_accessory_presets (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'tas' | 'kalung' | 'cincin' | 'anting'
  name text not null,
  prompt_fragment text not null,
  reference_image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## ai_generation_sets

```sql
create table ai_generation_sets (
  id uuid primary key default gen_random_uuid(),
  product_kode text references products(kode) not null,
  model_id uuid references ai_models(id),
  pose_id uuid references ai_poses(id),
  background_mode text not null default 'auto',
  background_preset_id uuid references ai_background_presets(id),
  background_description text,
  accessory_preset_ids jsonb default '[]',
  product_images jsonb not null,
  -- { front, back?, detailNeck?, detailSleeve?, detailHand?, detailChest?,
  --   detailHem?, fullBody? } — detailHand ditambahkan Agustus 2026,
  -- terpisah dari detailSleeve (manset/pergelangan vs bahu/lengan atas)
  product_warna text,
  status text not null default 'queued',
  -- 'queued' | 'processing' | 'completed' | 'partial' | 'failed'
  total_cost integer, -- akumulasi biaya foto (Rupiah) untuk set ini
  published_at timestamptz,
  published_image_urls jsonb,
  created_at timestamptz default now(),
  -- Video "cerita gabungan" (Agustus 2026)
  video_status text, -- 'processing' | 'completed' | 'failed' | null
  video_url text,
  video_error_message text,
  video_started_at timestamptz,
  video_clip_jobs jsonb default '[]', -- [{requestId, sourceUrl, status, clipUrl}]
  video_merge_request_id text,
  video_cost integer -- akumulasi biaya video (Rupiah) untuk set ini
);
```

## ai_generations

```sql
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  generation_set_id uuid references ai_generation_sets(id) not null,
  image_role text not null, -- 'utama' | 'detail' | 'seri' | 'angle'
  pose_id uuid references ai_poses(id), -- terisi utk 'utama'/'angle'
  variant_warna text, -- terisi utk 'seri' — nama warna varian
  variant_product_images jsonb, -- terisi utk 'seri' — { image: url foto full-body warna itu }
  vto_image_url text,
  output_image_url text,
  has_stage2 boolean default false,
  status text not null default 'queued',
  generation_time_ms integer,
  cost integer, -- Rupiah
  error_message text,
  created_at timestamptz default now(),
  -- Video per-generation (opsional, sebelum "video cerita gabungan" jadi default)
  video_url text,
  video_status text,
  video_generation_time_ms integer,
  video_cost integer
);
```

## content_posts (Content Studio, Agustus 2026)

```sql
create table content_posts (
  id uuid primary key default gen_random_uuid(),
  product_kode text not null,
  secondary_product_kodes jsonb default '[]', -- mode grup, 2-5 produk
  image_urls jsonb not null default '[]',
  content_type text not null, -- 'feed_single' | 'carousel' | 'reel'
  theme text, -- 'produk_highlight' | 'tips_styling' | 'brand_story' | 'promo' | 'brand_awareness'
  caption text,
  hashtags jsonb default '[]',
  extra_notes text,
  scheduled_at timestamptz,
  status text not null default 'draft', -- 'draft' | 'scheduled' | 'published' | 'failed'
  instagram_media_id text,
  published_at timestamptz,
  error_message text,
  created_by_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  video_url text
);
```

## ai_cost_log (Agustus 2026 — pencatatan biaya terpusat, lihat §18)

```sql
create table ai_cost_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null, -- lihat AiCostFeature di lib/cost-log-shared.ts
  model text,
  cost_usd numeric not null,
  ref_type text, -- 'generation_set' | 'generation' | 'content_post'
  ref_id uuid,
  note text
);
```

## products.warna_images (kolom tambahan di tabel Deera existing)

`jsonb`, dipakai fitur "seri" (§7.6) untuk menyimpan foto per varian
warna produk (dipublish dari Deera Studio, dibaca katalog untuk
color-swatch picker di halaman detail produk).

---

# 13. Storage Structure

## Supabase Storage (bucket `ai-fashion-studio`, file kerja)

```text
ai-fashion-studio/
  models/{model_id}/reference/
  poses/{pose_id}/
  products/{product_kode}/flat-lay/
  generated/{generation_set_id}/...
  content-posters/            -- hasil render poster (Content Studio)
  content-marketing-photos/   -- hasil Foto Marketing AI / Foto Gabungan Produk AI
```

## Cloudinary (hasil final, setelah publish)

```text
deera/products/{product_kode}/
  ai-utama.jpg, ai-detail-1.jpg, ..., ai-seri-{warna}.jpg
```

URL Cloudinary hasil upload inilah yang ditulis ke
`products.image`/`products.detail`/`products.warna_images` saat admin
menekan **Publish**.

---

# 14. UI Pages

## /login
Form login (auto-suffix `@deera.id`), dibungkus background interaktif
`KineticGrid` (partikel kinetik yang bereaksi ke pointer) — sama seperti
semua halaman lain setelah login.

## /dashboard
Ringkasan operasional (REVISI Agustus 2026 v2): SKU diproses bulan ini,
konten Content Studio dibuat bulan ini, **biaya bulan ini** (gabungan
foto/video Generate-History + SEMUA biaya Content Studio dari
`ai_cost_log` — sebelumnya hanya menjumlah `total_cost` dan melewatkan
`video_cost` serta seluruh Content Studio, sudah diperbaiki), **biaya
sepanjang waktu**, rincian biaya per fitur (progress bar), daftar "perlu
perhatian" (set/post yang gagal), aktivitas terbaru lintas Generate/
History + Content Studio, dan jumlah model aktif.

## /models, /poses
Manajemen model & pose per model — form tambah dengan layout
upload-di-kiri, field-di-kanan; tiap kartu punya mode edit inline.

## /presets
Manajemen background & aksesoris — sama, form upload-di-kiri +
kemampuan edit gambar/field kartu yang sudah ada (termasuk yang lama
tanpa gambar, bisa ditambahkan belakangan).

## /generate
Halaman utama generate — pilih produk dari katalog Deera (grid gambar),
model/pose (grid gambar), background (thumbnail preset atau custom),
aksesoris (pill dengan thumbnail bulat kecil), upload flat-lay (termasuk
slot Detail Tangan terpisah), atur jumlah foto detail/seri, generate.

## /history
Riwayat per SKU/set dengan **pagination (10/halaman) + search kode
produk**. Tombol Publish, Tambah Warna Seri, dan Generate Video (dengan
progress polling) per set.

## /content
Content Studio — pemilihan 1-5 produk, panel tema/tipe konten, panel
Poster AI (headline/subtitle/caption bawah/scene + render poster), panel
Foto Marketing AI / Foto Gabungan Produk AI (per-slide untuk carousel),
panel Video, panel caption+hashtag, kalender konten, dan daftar "Semua
Konten" dengan **pagination + search**.

---

# 15. API Contract (ringkasan endpoint aktif)

## Generate/History
* `POST /api/generate-set` — generate satu set foto.
* `GET /api/generation-sets/:id` — detail set.
* `POST /api/generation-sets/:id/add-seri` — tambah warna seri ke set
  yang sudah ada, tanpa re-generate utama.
* `POST /api/generation-sets/:id/publish` — push ke katalog Deera
  (Cloudinary + `products.image`/`detail`/`warna_images`).
* `POST /api/generation-sets/:id/generate-video` — submit job video
  cerita gabungan.
* `GET /api/generation-sets/:id/generate-video/status` — polling status
  video (reconcile klip → merge → selesai).
* `POST /api/generations/:id/regenerate` — generate ulang satu gambar.

## Content Studio
* `POST /api/content-posts` — buat draft.
* `PATCH /PATCH /DELETE /api/content-posts/:id` — update/hapus draft.
* `POST /api/content-posts/:id/publish` — publish ke Instagram.
* `POST /api/content/generate-caption` — caption + hashtag.
* `POST /api/content/suggest-headline` — Poster AI (headline/subtitle/
  bottomCaption/sceneIdea).
* `POST /api/content/suggest-storyboard` — alur cerita multi-slide (1
  produk).
* `POST /api/content/suggest-group-storyboard` — alur cerita grup (2-5
  produk).
* `POST /api/content/render-poster` — render poster PNG.
* `POST /api/content/generate-marketing-photo` — restyle 1 foto.
* `POST /api/content/generate-combo-photo` — gabung 2-5 foto jadi 1 frame.
* `POST /api/content/generate-video` — submit job video (stateless).
* `GET /api/content/generate-video/status` — polling status video.
* `POST /api/content/generate-calendar` — kalender konten bulanan.
* `GET /api/content/instagram-status` — cek koneksi akun Instagram.

### Perilaku Publish (foto)
* Hanya gambar dengan `status = 'completed'` yang bisa dipublish.
* Update `products.image`/`detail`/`warna_images` bersifat overwrite —
  admin diberi konfirmasi eksplisit sebelum menimpa foto lama.
* `published_at` dan `published_image_urls` diisi setelah sukses, sebagai
  jejak audit.

---

# 16. Error Handling

| Case                       | Penanganan                             |
| --------------------------- | ------------------------------------ |
| File terlalu besar/format salah | Ditolak di dropzone sebelum upload |
| Generate foto (Nano Banana Pro/Kontext) gagal | Status `failed` per gambar, foto lain dalam set tetap lanjut (`status: partial` di level set) |
| Generate video (klip/merge) gagal | `video_status: failed` + `video_error_message`, tidak menghapus foto yang sudah selesai |
| AI timeout / provider gagal | Pesan error ditampilkan via toast, admin bisa retry |
| Pencatatan biaya (`ai_cost_log`) gagal | **Tidak pernah menggagalkan fitur utama** — `logAiCost()` best-effort, gagal cuma di-`console.error`, generate tetap selesai |
| Publish Instagram gagal | `content_posts.status: failed` + `error_message`, muncul di Dashboard "Perlu perhatian" |

---

# 17. Security

* Semua halaman (kecuali `/login`) dilindungi auth (`middleware.ts` +
  `ProtectedRoute`).
* Storage bucket privat kecuali yang memang perlu public read (hasil
  akhir untuk ditampilkan/didownload).
* API key Fal.ai/Cloudinary/Instagram hanya di server (Route Handler),
  tidak pernah dikirim ke browser.
* Tabel baru (`ai_*`, `content_posts`, `ai_cost_log`) punya RLS policy
  sendiri, tidak mewarisi policy tabel Deera lama.
* Insert ke `ai_cost_log` HANYA lewat service-role client server
  (`logAiCost()`, `lib/cost-log.ts`) — tidak bisa dipalsukan dari
  browser. Tabel itu hanya bisa **dibaca** oleh authenticated user lewat
  RLS (dipakai Dashboard).
* Akses tulis ke `products` (saat publish) dibatasi lewat service role di
  server saja.

---

# 18. Monitoring & Cost Tracking

**Pencatatan biaya AI terpusat (`ai_cost_log`, Agustus 2026)** — dibuat
setelah investigasi menemukan bahwa Dashboard versi sebelumnya HANYA
menjumlah `ai_generation_sets.total_cost` (pipeline foto Generate/
History), melewatkan `video_cost` (kolom terpisah di tabel yang sama)
DAN seluruh biaya Content Studio (caption/headline/storyboard AI, Foto
Marketing AI, Foto Gabungan Produk AI, video Content Studio) yang sama
sekali tidak tercatat di mana pun.

Sekarang setiap panggilan AI berbayar yang sebelumnya tidak tercatat
dicatat lewat `logAiCost()` (`lib/cost-log.ts`, service-role, best-effort
— gagal catat tidak pernah menggagalkan fitur utama) ke `ai_cost_log`,
dan Dashboard (§14) menjumlah **semua sumber** (kolom `total_cost`/
`video_cost` di `ai_generation_sets` UNTUK Generate/History, PLUS
`ai_cost_log` UNTUK Content Studio) — tidak dobel-hitung karena tiap
sumber biaya cuma dicatat di SATU tempat.

Belum ada monitoring error terpusat (Sentry dsb) — error saat ini
ditangani lewat toast di UI + `console.error` di server, cukup untuk
skala pemakaian internal saat ini.

---

# 19. Roadmap

## Sudah selesai (dulu direncanakan sebagai V1/V2, sekarang live)
* Generate foto katalog (Nano Banana Pro single-stage).
* Video AI — dulu "ditunda ke V2", sekarang live sejak Agustus 2026 di
  History DAN Content Studio.
* Content Studio penuh (caption, poster, foto marketing, foto gabungan,
  publish Instagram) — tidak ada di rencana awal sama sekali.
* Pencatatan biaya terpusat + Dashboard yang akurat.

## Berikutnya (belum diimplementasi)
* Batch generate (banyak SKU sekaligus dalam satu antrian).
* Auto QC AI (deteksi kualitas otomatis sebelum ditampilkan admin).
* Integrasi marketplace (auto-upload Shopee/Tokopedia).
* Multi-user role (approval workflow terpisah).
* Auto-resize multi-format marketplace.
* Monitoring error terpusat (Sentry atau setara), kalau skala pemakaian
  bertambah besar.
* Background bertema kampanye/musiman (Lebaran, Ramadan) — perluasan
  mode Auto yang sudah ada.

---

# 20. Estimasi & Realita Biaya Operasional

## Harga dasar Fal.ai (per Agustus 2026, diverifikasi ulang)

| Item | Harga | Catatan |
| --- | --- | --- |
| Nano Banana Pro edit (1K) — foto utama/angle/seri, dan Foto Marketing/Gabungan AI di Content Studio | $0.15/gambar (~Rp 2.700) | Mesin utama, dipakai di hampir semua fitur foto |
| FLUX Kontext Pro — foto detail (crop) | $0.04/gambar (~Rp 640) | Cuma reframe, bukan re-render |
| Kling 3.0 Pro image-to-video — per klip, audio off | $0.112/detik (~Rp 2.005/detik) | Klip 5 detik ≈ Rp 10.025 |
| ffmpeg-api/merge-videos — gabung klip | $0/detik compute | Gratis, operasi ffmpeg murni |
| openrouter/router (Claude Sonnet 4.5) — text-gen Content Studio | Bervariasi per panggilan, fal.ai melaporkan `usage.cost` aktual per request | Dicatat otomatis ke `ai_cost_log`, bukan estimasi tetap |

Tidak ada biaya training model.

## Estimasi biaya per set foto (bervariasi tergantung jumlah gambar diminta admin)

Admin mengatur sendiri berapa banyak foto angle/detail/seri per set
(kontrol biaya) — bukan lagi paket tetap "5 gambar" seperti rencana awal.
Contoh: set dengan 1 utama + 3 detail + 1 seri ≈ Rp 2.700 + (3×Rp 640) +
Rp 2.700 ≈ **Rp 7.320**.

## Pencatatan biaya nyata (bukan lagi cuma estimasi kasar)

Sejak Agustus 2026 (§18), SEMUA panggilan AI berbayar tercatat di
`ai_cost_log` (Content Studio) dan kolom `total_cost`/`video_cost`
(Generate/History), dijumlah akurat di Dashboard per bulan & sepanjang
waktu, dengan rincian per fitur. Untuk angka tagihan pasti (bukan
estimasi), rujukan utamanya tetap dashboard billing fal.ai sendiri —
aplikasi ini menghitung berdasarkan harga yang diketahui publik dan
`usage.cost` yang dilaporkan fal.ai sendiri untuk text-gen, tapi tidak
menggantikan invoice resmi fal.ai.

## Biaya lain

| Item | Estimasi |
| --- | --- |
| Supabase | Rp 0 tambahan (project Deera yang sudah ada) |
| Cloudinary | Rp 0 tambahan (akun Deera yang sudah ada) |
| Instagram Graph API | Gratis (butuh App Review Meta, proses 2-4 minggu) |
| Domain | Rp 20.000 |

---

# 21. Definition of Done (MVP — status: TERCAPAI)

* Admin dapat login. ✅
* Admin dapat kelola model, pose, preset background/aksesoris (dengan
  gambar referensi yang bisa diedit belakangan). ✅
* Admin dapat upload produk (foto flat-lay, termasuk slot Detail Tangan
  terpisah). ✅
* Generate menghasilkan set foto lengkap dengan background sesuai
  pilihan dan warna kerudung/heels otomatis mengikuti produk. ✅
* Admin dapat generate video cerita gabungan dari foto-foto hasil. ✅
* Hasil tersimpan di Supabase, dikelompokkan per SKU, dengan
  pagination+search. ✅
* Admin dapat publish set terpilih ke katalog Deera. ✅
* Admin dapat generate & publish konten Instagram lewat Content Studio. ✅
* Biaya generate tercatat AKURAT (semua fitur, bukan cuma sebagian) dan
  tampil di Dashboard. ✅

---

# 22. Riwayat Keputusan (arsip — v0.1 sampai v0.5, sebelum implementasi)

Bagian ini adalah **arsip historis** dari proses perencanaan sebelum
development dimulai — dipertahankan untuk konteks "kenapa" sebuah
keputusan pernah diambil, BUKAN deskripsi keadaan sekarang (lihat §1-§21
untuk itu).

| Revisi | Perubahan utama |
| --- | --- |
| v0.1 | Draft awal — training LoRA per model, background studio putih terkunci, video termasuk MVP. |
| v0.2 | Satu generate = satu SET foto (bukan 1 gambar), background mulai bervariasi lewat preset, video ditunda ke fase 2. |
| v0.3 | Pivot mesin utama ke FLUX Virtual Try-On (Black Forest Labs) menggantikan LoRA — tidak perlu training, FLUX Kontext Pro jadi tahap 2 opsional untuk background/aksesoris. |
| v0.4 | Tabel baru ditaruh di project Supabase Deera yang sudah ada (bukan project terpisah) supaya bisa foreign-key ke `products` dan publish balik. Aksesoris diperluas (tas/kalung/cincin/anting jadi preset, kerudung/heels tetap auto-warna). |
| v0.5 | Background dirombak jadi dua mode (preset terkurasi 15-20+ + AI improvisasi, dicampur mode Auto) — tahap 2 (edit background) jadi default aktif untuk semua produk, bukan opsional lagi. Kapasitas budget diturunkan demi kualitas visual. |
| **v1.0 (dokumen ini, pasca-implementasi)** | **Pivot terbesar**: mesin utama diganti total dari FLUX VTO+Kontext 2-tahap menjadi **Nano Banana Pro single-stage** (§9) setelah tes manual pemilik brand membuktikan akurasi motif/tekstur jauh lebih baik. Video AI **dipindah dari "V2" ke live di V1** (§7.8). **Content Studio ditambahkan** sepenuhnya di luar rencana awal (§7.9). Desain visual dirombak dari rencana "light mode gold" jadi dark glassmorphism. Pencatatan biaya terpusat (`ai_cost_log`) ditambahkan setelah ditemukan gap nyata antara biaya top-up fal.ai admin dan angka yang tercatat di Dashboard versi lama (§18, §20). |

Keputusan detail per topik (model AI, sumber foto pose, cakupan
aksesoris, lokasi database, dst) yang relevan dengan arsitektur v0.1-v0.5
tetap berlaku sebagai konteks historis kecuali disebutkan berubah di
tabel di atas atau di §1-§21.

---

# 23. Lampiran

## Naming convention file (SUDAH TIDAK RELEVAN)

Rencana awal (v0.1-v0.5) mengasumsikan admin mengikuti naming convention
file lokal (`AGM-{kode}-front.jpg`, dst) sebelum upload. Ini **tidak lagi
berlaku** — upload sekarang lewat dropzone drag & drop langsung dari
browser ke Supabase Storage (`react-dropzone`), nama file asli tidak
dipakai sebagai metadata, semua konteks (role foto, kode produk, dst)
disimpan lewat struktur data (`product_images` di `ai_generation_sets`),
bukan lewat nama file.
