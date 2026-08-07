# PRD — AI Fashion Studio (Deera / Agumi)

**Versi:** 0.5 (MVP — background dinamis & mewah, prioritas kualitas)
**Tanggal:** 6 Agustus 2026
**Owner:** Denny Angesti Pratama
**Status:** Draft — siap masuk tahap desain teknis

> **Catatan revisi v0.2:** Merevisi v0.1 setelah diskusi kebutuhan produksi
> (lihat §22). Perubahan utama: satu kali generate menghasilkan **satu set
> foto** (bukan satu gambar), background bervariasi mengikuti gaya produk
> (bukan dikunci studio putih), warna kerudung & heels mengikuti warna produk
> otomatis, dan **video ditunda ke fase 2**.
>
> **Catatan revisi v0.3:** Setelah riset perbandingan model AI, mesin utama
> diganti dari FLUX.1 Kontext Pro + training LoRA menjadi **FLUX Virtual
> Try-On (FLUX VTO)** — model dari Black Forest Labs yang dibuat khusus untuk
> kasus "pakaikan produk ke foto model" dan secara eksplisit menjaga detail
> pakaian (logo, print, jahitan) tetap utuh. Ini **menghilangkan kebutuhan
> training LoRA sepenuhnya** untuk MVP — cukup pakai foto model biasa sebagai
> referensi tiap generate. FLUX Kontext Pro / Nano Banana tetap dipakai
> sebagai **tahap kedua opsional** untuk variasi background dan penambahan
> aksesoris. Lihat §9 dan §22 untuk detail. Pose diputuskan terikat per
> model, diisi dari arsip foto katalog vendor lama (Deera punya hak pakai
> penuh).
>
> **Catatan revisi v0.4:** Dua keputusan tambahan hasil diskusi lanjutan.
> Pertama, tabel-tabel baru AI Fashion Studio (`models`, `poses`,
> `generation_sets`, dst) ditaruh di **project Supabase Deera yang sudah
> ada** — bukan project terpisah — supaya data produk (`products.kode`,
> `warna`) bisa diakses langsung lewat foreign key, dan hasil generate bisa
> dipush balik ke katalog Deera. Kedua, aksesoris diperluas cakupannya:
> kerudung & heels tetap otomatis ikut warna produk (tanpa preset gaya),
> sementara tas, kalung, cincin, dan anting jadi preset opsional yang bisa
> dipilih admin. Lihat §7.4, §10, §12, dan §22.
>
> **Catatan revisi v0.5:** Sistem background dirombak supaya tidak terasa
> berulang. Kombinasi dua mekanisme: (1) library preset diperbesar jadi
> 15-20+ tema mewah dengan **auto-rotasi & pencocokan** ke kategori/warna
> produk (bukan admin pilih manual tiap kali), dan (2) mode **AI
> Improvisasi** — server menyusun deskripsi background baru tiap generate
> dari kombinasi elemen (material, mood, setting, warna aksen) yang
> disesuaikan produk, tanpa perlu foto referensi tetap. Sistem otomatis
> mencampur kedua mode ("auto"). Konsekuensi: tahap 2 (edit background)
> praktis jadi default aktif untuk semua produk (bukan opsional lagi),
> sehingga kapasitas bulanan diturunkan ke ~55 SKU/bulan dengan budget Rp
> 500rb — **keputusan sadar untuk memprioritaskan kualitas visual**. Lihat
> §3, §7.4, §7.6, §9, §12, §20.

---

# 1. Ringkasan Produk

AI Fashion Studio adalah aplikasi web internal untuk menghasilkan foto katalog
gamis secara otomatis menggunakan AI, sebagai pengganti proses foto studio
konvensional dengan vendor (studio + model + fotografer + editor).

Alur inti: admin upload foto produk **raw flat-lay** (gamis difoto rata tanpa
model) → sistem "pakaikan" produk itu ke foto model referensi lewat model AI
virtual try-on (FLUX VTO), lalu opsional diperkaya background/aksesoris lewat
tahap edit kedua — dengan wajah model tetap konsisten (karena berasal
langsung dari foto referensi yang sama), dan warna kerudung/heels mengikuti
warna produk — sambil menjaga detail kain, bordir, motif, dan siluet produk
**identik dengan aslinya** (tidak ditambah atau dikurangi AI).

Tujuan utama:
* Mengurangi biaya foto studio vendor.
* Mempercepat produksi katalog.
* Menjaga konsistensi model, pose, dan kualitas visual.
* Mempertahankan detail produk semaksimal mungkin — ini adalah **syarat mutlak**,
  bukan preferensi.

---

# 2. Latar Belakang

Saat ini pembuatan foto katalog Deera menggunakan vendor eksternal — studio,
model, dan fotografer mereka. Untuk brand dengan banyak SKU, proses ini lambat,
mahal, dan sulit dijadwalkan ulang setiap ada produk baru.

AI Fashion Studio ditujukan sebagai mesin produksi katalog berbasis AI:
input-nya foto produk flat-lay yang sudah rutin dikerjakan tim internal,
output-nya adalah **set foto siap upload** ke marketplace/website — tanpa
tergantung jadwal vendor.

---

# 3. Tujuan Bisnis

## KPI MVP (3 bulan)

* Waktu produksi satu **set foto** (5 gambar) per SKU < 5 menit end-to-end.
* Minimal 70% hasil langsung layak upload tanpa edit manual.
* Pengurangan biaya foto studio vendor minimal 50%.
* Mampu memproses minimal **~55 SKU per bulan** dengan budget Rp 500.000
  (revisi v0.5, lihat §20) — angka ini lebih kecil dari perkiraan v0.3/v0.4
  (80–100 SKU) karena keputusan sadar untuk memprioritaskan **kualitas
  visual** (background bervariasi & mewah di setiap produk) di atas volume.
  Kapasitas bisa naik ke ~100 SKU/bulan lagi kalau budget ditambah ke ~Rp
  900.000/bulan, atau kalau sebagian produk memakai background dari pool
  yang lebih sering diulang.

> Catatan riwayat: v0.2 sempat menurunkan target ke 50-70 SKU karena biaya
> training LoRA. v0.3/v0.4 menaikkannya lagi ke 80-100 SKU/bulan setelah
> LoRA dihapus. **v0.5 menurunkannya lagi secara sadar** — bukan karena
> constraint teknis, tapi karena keputusan bisnis: background variatif &
> mewah di *setiap* produk (§7.4) butuh tahap 2 (edit background) hampir
> selalu aktif, yang menaikkan biaya per produk. Kualitas dipilih di atas
> volume untuk MVP. Lihat §20 untuk rincian biaya.

---

# 4. Scope MVP

## In Scope

* Login admin.
* Upload model AI (foto referensi model — tanpa training, langsung siap pakai).
* Upload pose referensi.
* Upload produk (foto flat-lay: depan, belakang, detail bordir, detail lengan).
* **Generate satu set foto per produk**: 1 foto utama + 3 foto detail + 1 foto
  seri (jika produk punya varian seri/motif berbeda).
* Pemilihan background per produk (preset, disesuaikan gaya gamis).
* Warna kerudung & heels otomatis mengikuti warna produk (dari field `warna`).
* Aksesoris pelengkap (tas, dll) sebagai preset opsional untuk mempercantik foto.
* Menyimpan hasil generate (per set, bukan per gambar lepas).
* Download hasil (per gambar atau seluruh set).
* Riwayat generate, dikelompokkan per produk (SKU).

## Out of Scope (V2+)

* **Video AI ("video cantik")** — dipindah ke fase 2 (lihat §19), setelah
  workflow foto stabil dan budget bertambah.
* Batch generate (generate banyak SKU sekaligus dalam satu antrian).
* Auto QC AI (deteksi otomatis kualitas hasil sebelum ditampilkan ke admin).
* Integrasi marketplace (auto-upload ke Shopee/Tokopedia dll).
* Multi-user role (approval workflow, role reviewer terpisah).
* Mobile app.
* Auto-resize ke berbagai format marketplace (V3).

---

# 5. Persona Pengguna

## Admin Brand

* Mengelola model AI (upload foto referensi, aktivasi/nonaktifkan).
* Mengelola pose.
* Mengelola preset background & aksesoris.
* Melakukan generate set foto katalog.

## Tim Konten

* Upload produk baru (foto flat-lay).
* Memilih background/aksesoris saat generate (atau pakai auto-suggest).
* Mengunduh hasil.
* Mengunggah ke marketplace (manual, di luar sistem ini untuk MVP).

---

# 6. User Journey

1. Login.
2. **(Setup awal, sekali per model)** Buka halaman **Models** → buat entri
   model → buka halaman **Poses**, upload beberapa foto pose untuk model itu
   (bisa langsung pakai foto katalog lama dari vendor, karena Deera punya hak
   pakai penuh — tidak perlu foto ulang). Tanpa training, langsung siap
   dipakai begitu tersimpan.
3. Buka halaman **Generate**.
4. Pilih model.
5. Pilih pose (salah satu foto pose milik model itu).
6. Pilih background (preset sesuai gaya produk) — bisa auto-suggest berdasar
   kategori produk.
7. Upload foto flat-lay produk (depan, belakang, detail — sesuai naming
   convention §23).
8. Sistem otomatis membaca warna produk untuk menentukan warna kerudung & heels.
9. (Opsional) Pilih aksesoris pelengkap (tas, dll).
10. Klik **Generate Set**.
11. Sistem memproses **tahap 1** (FLUX VTO — pakaikan produk ke foto model)
    untuk foto utama dulu → lalu 3 foto detail → lalu foto seri (jika ada),
    lalu **tahap 2** (edit background/aksesoris bila dipilih) — status per
    gambar terlihat (queued/processing/completed).
12. Hasil set foto muncul (5 gambar).
13. Admin review, generate ulang gambar tertentu jika belum pas, lalu download
    atau simpan.

---

# 7. Functional Requirements

## 7.1 Authentication

* Login email + password.
* Session menggunakan Supabase Auth — **project sama dengan Deera** (§10),
  jadi admin bisa pakai akun yang sama dengan admin.deera.id tanpa perlu
  daftar ulang. Perlu dicek saat implementasi apakah semua akun admin Deera
  otomatis punya akses, atau dibatasi lewat role/claim tambahan.

## 7.2 Model Management (revisi v0.3 — tanpa training, cukup foto referensi)

> **Perubahan dari v0.2:** Karena mesin utama sekarang FLUX VTO (§9), model
> tidak perlu dilatih (tidak ada LoRA). Cukup upload beberapa foto model
> sebagai referensi — foto itu langsung dipakai sebagai "Human Image" di
> setiap generate. Konsistensi wajah terjaga karena FLUX VTO memang
> mempertahankan orang di foto input apa adanya, bukan dari hasil training.

### Fields

* id
* name
* thumbnail_url
* is_active

### Actions

* Create
* Update
* Delete
* Activate/Deactivate

---

## 7.3 Pose Management (revisi v0.3 — pose kini terikat per model, bukan generik)

> **Perubahan penting dari v0.1/v0.2:** Di FLUX VTO, identitas model dan pose
> menyatu dalam satu foto (`human_image`) — tidak seperti rencana LoRA lama
> di mana wajah dikunci lewat training dan pose diatur bebas lewat prompt.
> Artinya satu "pose" harus berupa **foto sungguhan dari model tersebut**
> dalam pose itu, bukan referensi pose generik yang bisa dipakai model
> manapun. Karena itu `poses` sekarang selalu terikat ke `model_id` tertentu.
>
> **Keputusan (hasil diskusi):** karena Deera punya hak pakai penuh atas
> foto-foto katalog lama dari vendor, foto-foto itu bisa langsung dipakai
> sebagai isi awal pose library per model — tidak perlu foto ulang. Admin
> tinggal upload beberapa foto lama terbaik (variasi pose/gestur) dari model
> yang sama, dan FLUX VTO akan mengganti pakaian di foto itu dengan produk
> baru, sambil mempertahankan wajah, pose, dan background studio aslinya.
> Foto pose baru (real atau AI-generated) baru diperlukan kalau suatu saat
> butuh variasi pose di luar yang sudah ada di foto lama.

### Fields

* id
* model_id (wajib — pose ini adalah foto model tertentu, bukan generik)
* name (mis. "Duduk Sofa Tangan Dagu", "Berdiri Depan Rak")
* reference_image_url — foto model dalam pose ini (boleh dari katalog vendor
  lama, karena Deera punya hak pakai penuh)
* description
* is_active

### Actions

* Upload pose (terikat ke satu model)
* Edit nama/deskripsi
* Delete
* Activate/Deactivate

---

## 7.4 Background & Accessory (revisi v0.5 — background dinamis, dua mode)

> **Cakupan aksesoris (hasil diskusi v0.4, tidak berubah):** kerudung dan
> heels **tidak** masuk sistem preset — warnanya otomatis mengikuti warna
> produk lewat prompt tahap 2 (§7.6), tanpa pilihan gaya. Yang masuk preset
> opsional adalah aksesoris pelengkap: tas, kalung, cincin, anting.
>
> **Background (hasil diskusi v0.5):** supaya tidak terasa berulang dan
> tetap terasa mewah/menyesuaikan tiap produk, sistem punya **dua mode**
> yang bisa dicampur:
>
> **Mode Preset (terkurasi)** — library 15-20+ tema mewah yang dikurasi
> Denny/admin sekali di awal (mis. "Marmer & Emas", "Taman Golden Hour",
> "Butik Velvet Dusty Rose", "Teras Mediterania", "Lounge Kaca Patri").
> Setiap preset punya tag mood & warna yang cocok, dan sistem **auto-rotasi**
> — menghindari memakai preset yang sama berturut-turut untuk kategori
> produk yang sama, dan **auto-matching** — memprioritaskan preset yang
> warna/mood-nya selaras dengan produk.
>
> **Mode AI Improvisasi** — tanpa foto referensi tetap, server menyusun
> deskripsi background baru tiap generate dari kombinasi elemen: material
> (marmer, beludru, kayu jati, kaca patri, satin), mood/pencahayaan (golden
> hour, cahaya lembut pagi, dramatis malam hari), setting (lounge, teras,
> taman, butik, kamar pengantin), dan warna aksen yang diselaraskan dengan
> `products.warna`. Kombinasi ini menghasilkan ribuan variasi tanpa perlu
> foto referensi baru — cukup teks prompt yang disusun otomatis, tidak
> butuh panggilan AI/LLM tambahan (hemat biaya & latensi).
>
> **Mode Auto (default, hasil keputusan)** — sistem mencampur kedua mode
> di atas secara otomatis tiap generate (mis. rasio acak 60% preset / 40%
> improvisasi, bisa disetel), supaya hasil tetap terkontrol kualitasnya
> (dari mode preset) sekaligus variatif (dari mode improvisasi). Admin
> tetap bisa override manual pilih salah satu mode atau preset spesifik
> kalau mau kontrol penuh untuk produk tertentu.

### Fields — `background_presets`

* id
* name (mis. "Marmer & Emas", "Taman Golden Hour")
* prompt_fragment — deskripsi lengkap untuk disisipkan ke prompt tahap 2
* reference_image_url (opsional — kalau ada foto acuan visual)
* mood_tags — array (mis. `["mewah","romantis","hangat"]`) untuk matching
* warna_affinity — array warna yang cocok (mis. `["pink","dusty rose","cream"]`)
* cocok_untuk_kategori — tag kategori produk (mis. "Gamis Jumbo") untuk auto-suggest
* last_used_at, use_count — untuk logika rotasi (hindari pemakaian berturut-turut)
* is_active

### Fields — `accessory_presets`

* id
* category — `tas` \| `kalung` \| `cincin` \| `anting`
* name (mis. "Tas Clutch Gold", "Kalung Mutiara Simple", "Anting Bulat Gold")
* reference_image_url atau prompt_fragment
* is_active

### Actions

* CRUD standar untuk `background_presets` & `accessory_presets`.
* Sistem pilih background otomatis (mode Auto) saat generate, dengan opsi
  admin override ke mode/preset spesifik.
* Admin bisa pilih lebih dari satu aksesoris (lintas kategori), mis. tas +
  kalung sekaligus, tapi disarankan maksimal 1 preset per kategori supaya
  tidak menumpuk terlalu ramai di satu foto.

---

## 7.5 Product Upload

### Minimum

* Foto depan (flat-lay).

### Optional

* Foto belakang.
* Detail bordir.
* Detail lengan.

### Validasi

* JPG/PNG.
* Maks 10 MB.

### Naming convention (lihat §23)

Tetap mengikuti pola `AGM-{kode}-front.jpg`, `-back.jpg`, `-detail-neck.jpg`,
`-detail-sleeve.jpg` — detail foto ini penting sebagai referensi tambahan agar
AI mempertahankan tekstur & motif secara akurat.

---

## 7.6 Generate Photo Set (revisi besar dari "Generate Image")

**Perubahan penting:** satu kali generate menghasilkan **satu set foto**
(1 utama + 3 detail + 1 seri, total 5 gambar), bukan 1 gambar per request
seperti di v0.1. Ini karena kebutuhan produksi katalog nyata butuh set foto
lengkap per SKU, bukan gambar lepas.

### Input

* model_id (foto referensi model, tanpa syarat training)
* pose_id
* background_mode — `auto` (default) \| `preset` \| `ai_improvised` (§7.4)
* background_preset_id (opsional — dipakai kalau mode `preset` atau saat
  mode `auto` memilih jatuh ke preset)
* accessory_preset_ids (opsional, array)
* product_images (foto flat-lay: front, back, detail-neck, detail-sleeve)
* product_warna (diambil otomatis dari data produk untuk warna kerudung/heels)

### Proses — dua tahap per gambar

**Tahap 1 — FLUX VTO (wajib, garment fidelity):** foto model referensi +
foto produk flat-lay → hasil model memakai produk, dengan detail
kain/bordir/motif dijaga oleh model VTO itu sendiri (purpose-built untuk
ini, lihat §9).

**Tahap 2 — Edit background & aksesoris (revisi v0.5 — default aktif,
bukan opsional lagi):** hasil tahap 1 diproses lagi lewat FLUX Kontext Pro
atau Nano Banana untuk mengganti seluruh background (bukan sekadar
menambah elemen) dan/atau menambahkan aksesoris, tanpa mengubah produk yang
sudah presisi dari tahap 1. Server dulu menentukan background lewat mode
Auto (§7.4) — pilih dari preset library atau susun deskripsi improvisasi —
sebelum memanggil Kontext Pro/Nano Banana. Karena setiap produk sekarang
selalu dapat background yang disesuaikan (bukan opsional), tahap ini
praktis berjalan di hampir semua generate — lihat dampak biaya di §20.

Urutan generate dalam satu set:

1. **Foto utama** — full body, pose utama, background terpilih. Generate
   dulu karena jadi acuan visual untuk foto lain dalam satu set.
2. **3 foto detail** — crop/fokus ke area tertentu (kerah, lengan, motif
   bordir), pakai foto detail flat-lay sebagai referensi tambahan supaya
   tekstur presisi.
3. **1 foto seri** (kondisional — hanya jika produk punya varian
   warna/motif seri) — variasi warna dari foto utama.

### Output — per gambar

* generated_image_url (hasil akhir setelah tahap 1 + tahap 2 jika ada)
* vto_image_url (hasil tahap 1, sebelum edit background — disimpan juga
  sebagai fallback/audit kalau tahap 2 gagal)
* generation_time_ms
* status: `queued` \| `processing` \| `completed` \| `failed`
* image_role: `utama` \| `detail` \| `seri`

### Prompt Tahap 1 — FLUX VTO

Input model ini bukan prompt panjang seperti Kontext Pro, melainkan
`human_image` (foto model) + `garment_image` (foto produk) + prompt singkat
opsional untuk arahan pose/framing:

```
A natural front-facing studio shot. The garment is worn as designed,
preserving original fabric texture, embroidery, stitching, and proportions.
```

### Prompt Tahap 2 — FLUX Kontext Pro / Nano Banana (revisi v0.5)

```
Replace the entire background with: {background_description}. Preserve the
person, the garment, pose, and all garment details exactly as in the input
image. Hijab color and heels color must match the garment's primary color:
{warna}. Add accessory if specified: {accessory_preset}.
```

`{background_description}` diisi dengan salah satu dari dua sumber,
ditentukan oleh `background_mode`:

* **Preset:** isi dari `background_presets.prompt_fragment` (mis. "interior
  mewah bernuansa marmer putih dengan aksen emas, pencahayaan lembut sore
  hari").
* **AI Improvisasi:** disusun server dari kombinasi elemen (§7.4), contoh
  hasil komposisi: "*teras mediterania dengan lantai marmer krem, tirai
  linen tertiup angin, pencahayaan golden hour, aksen warna senada dusty
  pink*" — disusun otomatis dari `products.warna` + kategori produk tanpa
  panggilan AI/LLM tambahan (murni templating di server, hemat biaya).

Bagian `{warna}`, `{background_description}`, `{accessory_preset}` diisi
otomatis dari data produk dan hasil pemilihan mode — kedua prompt dasar ini
disimpan di server dan tidak dapat diubah pengguna biasa.

---

## 7.7 Generation History (revisi — per set, bukan per gambar)

Menampilkan, dikelompokkan per **photo set**:

* tanggal
* model
* pose
* produk (kode & nama)
* status keseluruhan set (mis. "4/5 selesai")
* thumbnail 5 hasil (utama + detail + seri)
* biaya generate (Rp, untuk kontrol budget)

Admin bisa generate ulang gambar tertentu dalam satu set tanpa mengulang
seluruh set (mis. foto detail kurang pas, generate ulang foto itu saja).

---

# 8. Non-Functional Requirements

| Item          | Target                    |
| ------------- | ------------------------- |
| Response UI   | < 300 ms                  |
| Generate time tahap 1 (FLUX VTO) per gambar | < 4 detik (klaim resmi Black Forest Labs) |
| Generate time tahap 2 (edit background/aksesoris) per gambar | 20–90 detik (jika dipakai) |
| Generate time per set (5 gambar) | 1–3 menit (lebih cepat dari v0.2 karena tanpa training) |
| Availability  | 99%                       |
| Storage       | Supabase                  |
| Security      | Authenticated access only |

---

# 9. AI Pipeline

## Provider — revisi v0.3: dua model, dua peran berbeda

**Fal.ai** tetap jadi satu-satunya provider, tapi kombinasi modelnya diganti
setelah riset perbandingan (lihat §22):

1. **FLUX Virtual Try-On (`fal-ai/flux-pro/v1/vto`)** — mesin utama,
   **wajib** dipakai di tahap 1 tiap generate. Model ini dibuat khusus oleh
   Black Forest Labs untuk kasus "pakaikan produk fashion ke foto orang",
   dan secara eksplisit menjaga logo, print, jahitan, dan detail hardware
   tetap utuh — ini pas dengan syarat mutlak "detail produk tidak boleh
   ditambah/dikurangi". Input-nya cukup foto model + foto produk, output-nya
   foto model memakai produk itu. **Tidak butuh training apapun.**
2. **FLUX.1 Kontext Pro** atau **Nano Banana (Gemini 2.5 Flash Image /
   Nano Banana Pro)** — tahap 2, **default aktif di v0.5** (direvisi dari
   "opsional" di v0.3/v0.4). Karena background sekarang harus terasa
   bervariasi & mewah di setiap produk (§7.4), tahap ini praktis berjalan
   di hampir semua generate, bukan hanya saat admin memilih preset
   tertentu. Tugasnya mengganti seluruh background & menambah aksesoris
   pada hasil tahap 1, tanpa menyentuh produk.

> **Kenapa diganti dari v0.2 (FLUX Kontext Pro + LoRA):** Kontext Pro adalah
> model editing serba guna — bagus tapi tidak dilatih khusus menjaga
> fidelitas pakaian. FLUX VTO purpose-built untuk itu, hasilnya lebih bisa
> diandalkan untuk syarat "semirip mungkin, tanpa nambah/kurang", sekaligus
> lebih cepat (<4 detik vs 20-90 detik), lebih murah, dan tidak perlu
> training LoRA (hemat biaya + waktu setup + kompleksitas).

## Input

* Foto model referensi (dipakai langsung, tanpa training).
* Foto pose referensi.
* Foto produk flat-lay (depan, belakang, detail).
* Background (preset atau hasil komposisi improvisasi, §7.4) & aksesoris
  terpilih.
* Warna produk (untuk kerudung/heels, dipakai di tahap 2).

## Cara Kerja (disederhanakan untuk yang belum familiar)

Semua ini **tidak butuh aplikasi/server AI terpisah** — dipanggil langsung
dari Next.js lewat SDK JavaScript resmi Fal.ai (`@fal-ai/client`), dari
Route Handler atau Server Action (server-side, API key aman di server, tidak
pernah dikirim ke browser):

```
Upload foto (browser) → Supabase Storage
        |
        v
Next.js Server Action / Route Handler
        |
        v
TAHAP 1: Panggil FLUX VTO (foto model + foto produk)
        |
        v
Fal.ai memproses di server cloud mereka (bukan di komputer Denny)
        |
        v
Hasil tahap 1: foto model memakai produk (detail terjaga)
        |
        v
Server tentukan background (mode Auto: pilih preset atau susun deskripsi
improvisasi berdasarkan warna/kategori produk, lihat §7.4)
        |
        v
TAHAP 2 (default aktif di v0.5):
Panggil FLUX Kontext Pro / Nano Banana dengan hasil tahap 1 sebagai input
        |
        v
Hasil akhir: foto dengan background mewah & aksesoris sesuai pilihan
        |
        v
Simpan URL ke Supabase Storage + catat di Supabase Database
        |
        v
Tampilkan ke admin di dashboard
```

Karena tidak ada lagi training LoRA, seluruh proses generate satu gambar
kini **sinkron** (bisa ditunggu langsung, tidak perlu polling job
terpisah) — ini yang membuat estimasi waktu di §8 jauh lebih cepat
dibanding v0.2.

## Prompt

Lihat §7.6 untuk prompt tahap 1 (FLUX VTO) dan tahap 2 (Kontext Pro/Nano
Banana) — keduanya disimpan di server dan tidak dapat diubah pengguna biasa.

---

# 10. System Architecture

> **Revisi v0.4:** AI Fashion Studio **tidak** punya project Supabase
> sendiri — semua tabel baru (`models`, `poses`, `generation_sets`,
> `generations`, `background_presets`, `accessory_presets`) ditambahkan ke
> **project Supabase Deera yang sudah ada** (yang juga dipakai
> catalog/admin/pos/finance). Ini memungkinkan `generation_sets.product_kode`
> jadi foreign key asli ke `products.kode`, dan hasil generate yang sudah
> di-approve admin bisa **dipush langsung** untuk mengisi field
> `products.image` / `products.detail` / `products.video` — sehingga muncul
> otomatis di catalog.deera.id begitu dipublish (lihat §15,
> `POST /api/generation-sets/:id/publish`).

```text
Next.js Dashboard (Admin Brand, Tim Konten) — AI Fashion Studio, app baru
        |
        v
API Route / Server Action
        |
        +---> Supabase Database — PROJECT SAMA DENGAN DEERA
        |      ├─ tabel existing: products, stok_warna, sales, dst (dibaca)
        |      └─ tabel baru: models, poses, generation_sets, generations,
        |         background_presets, accessory_presets
        |
        +---> Supabase Storage (bucket/folder baru, terpisah dari folder
        |      produk Deera yang sudah ada — lihat §13)
        |
        v
Fal.ai API
   +-- FLUX Virtual Try-On (tahap 1, wajib, tiap gambar)
   +-- FLUX Kontext Pro / Nano Banana (tahap 2, opsional, background/aksesoris)
        |
        v
Generated Image
        |
        v
Supabase Storage
        |
        v
(setelah admin approve) Publish → update products.image/detail/video
        |
        v
Muncul di catalog.deera.id (apps/catalog, tanpa perubahan kode di app itu)
```

---

# 11. Tech Stack

## Frontend
* Next.js 15
* TypeScript
* Tailwind CSS
* shadcn/ui

## Backend
* Next.js Route Handlers
* Server Actions

## Database
* Supabase Postgres — **project sama dengan Deera** (bukan project baru),
  tabel baru ditambahkan di sana (lihat §10)

## Storage
* Supabase Storage — untuk file kerja (foto referensi model/pose, hasil
  generate sebelum di-publish). Project sama dengan Deera, bucket/folder
  baru terpisah.
* **Cloudinary** — untuk gambar final yang sudah di-publish ke katalog.
  Deera sudah pakai Cloudinary untuk `products.image`/`video`/`detail`
  (lihat CLAUDE.md Deera §2 & §11), jadi saat admin publish hasil generate,
  gambar diupload ke Cloudinary (akun Deera yang sama) supaya konsisten
  dengan cara catalog.deera.id menampilkan gambar (auto-format WebP/AVIF,
  dst). Lihat §13 dan §15.

## AI
* Fal.ai SDK (`@fal-ai/client`)
* FLUX Virtual Try-On (`fal-ai/flux-pro/v1/vto`) — mesin utama, garment fidelity
* FLUX.1 Kontext Pro / Nano Banana (Gemini 2.5 Flash Image) — edit tahap 2 (default aktif, §7.4/§9)

---

# 12. Database Schema

> **Catatan v0.4:** Semua tabel di bawah ini ditambahkan ke **project
> Supabase Deera yang sudah ada** (lihat §10) lewat migration baru — bukan
> project terpisah. Tabel `products`, `stok_warna`, dst dari Deera **tidak
> diubah**, hanya dibaca (dan `products` ditulis balik saat publish, lihat
> §15).

## models (revisi v0.3 — tanpa field LoRA, cukup foto referensi)

```sql
create table models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  thumbnail_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## poses (revisi v0.3 — terikat ke model_id, sumbernya boleh foto vendor lama)

```sql
create table poses (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references models(id) not null, -- pose = foto model TERTENTU, bukan generik
  name text not null,
  reference_image_url text not null, -- foto model dalam pose ini; dipakai langsung sebagai human_image di FLUX VTO
  description text,
  source text default 'vendor_archive', -- 'vendor_archive' | 'new_shoot' | 'ai_generated' — untuk audit asal foto
  is_active boolean default true,
  created_at timestamptz default now()
);
```

## background_presets (baru)

```sql
create table background_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt_fragment text not null, -- deskripsi background untuk disisipkan ke prompt
  reference_image_url text,
  mood_tags jsonb default '[]', -- ["mewah","romantis","hangat"] untuk matching
  warna_affinity jsonb default '[]', -- ["pink","dusty rose","cream"] warna yang cocok
  cocok_untuk_kategori jsonb default '[]', -- ["Gamis Jumbo", "Midi"] untuk auto-suggest
  last_used_at timestamptz, -- untuk logika rotasi, hindari pemakaian berturut-turut
  use_count integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

> **Baru v0.5:** target minimal 15-20 baris terisi di tabel ini sebelum
> launch, supaya mode Auto (§7.4) punya cukup variasi untuk dirotasi. Isi
> awal jadi bagian pekerjaan konten sebelum go-live, bukan cuma pekerjaan
> engineering.

## accessory_presets (revisi v0.4 — tambah kategori)

```sql
create table accessory_presets (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'tas' | 'kalung' | 'cincin' | 'anting'
  name text not null,
  prompt_fragment text not null,
  reference_image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);
```

> Kerudung & heels **tidak** punya tabel preset — warnanya otomatis
> dihitung dari `products.warna` saat generate (lihat §7.6), tidak disimpan
> sebagai pilihan admin.

## generation_sets (revisi v0.4 — product_kode jadi FK asli + status publish)

```sql
create table generation_sets (
  id uuid primary key default gen_random_uuid(),
  product_kode text references products(kode) not null, -- FK ASLI (v0.3: "longgar") — sama project dgn Deera
  model_id uuid references models(id),
  pose_id uuid references poses(id),
  background_mode text not null default 'auto', -- 'auto' | 'preset' | 'ai_improvised' (baru v0.5)
  background_preset_id uuid references background_presets(id), -- diisi kalau mode preset/auto jatuh ke preset
  background_description text, -- diisi kalau mode ai_improvised/auto jatuh ke improvisasi (hasil komposisi, lihat §7.6)
  accessory_preset_ids jsonb default '[]', -- array id dari accessory_presets, lintas kategori
  product_images jsonb not null, -- {front, back, detail_neck, detail_sleeve}
  product_warna text, -- diambil dari products.warna, dipakai untuk kerudung/heels
  status text not null default 'queued',
  -- 'queued' | 'processing' | 'completed' | 'partial' | 'failed'
  total_cost integer, -- akumulasi biaya generate (Rupiah) untuk set ini
  published_at timestamptz, -- diisi saat admin publish hasil ke katalog Deera (lihat §15)
  published_image_urls jsonb, -- snapshot URL yang dipush ke products.image/detail/video
  created_at timestamptz default now()
);
```

## generations (revisi v0.3 — tambah field dua tahap)

```sql
create table generations (
  id uuid primary key default gen_random_uuid(),
  generation_set_id uuid references generation_sets(id) not null,
  image_role text not null, -- 'utama' | 'detail' | 'seri'
  vto_image_url text, -- hasil tahap 1 (FLUX VTO), sebelum edit background
  output_image_url text, -- hasil akhir (setelah tahap 2 jika dipakai, atau sama dengan vto_image_url jika tidak)
  has_stage2 boolean default false, -- true jika background/aksesoris diedit di tahap 2
  status text not null default 'queued',
  generation_time_ms integer,
  cost integer, -- biaya gambar ini dalam Rupiah (akumulasi tahap 1 + tahap 2)
  error_message text,
  created_at timestamptz default now()
);
```

---

# 13. Storage Structure (revisi v0.4 — Supabase Storage untuk kerja, Cloudinary untuk publish)

## Supabase Storage (file kerja, belum tentu final)

```text
ai-studio/
  models/
    {model_id}/reference/       -- foto referensi model (dipakai langsung, tanpa training)
  poses/
    {pose_id}/                  -- foto pose (boleh dari arsip vendor lama)
  products/
    {product_kode}/flat-lay/    -- foto raw flat-lay yang diupload admin
  generated/
    {generation_set_id}/utama.jpg
    {generation_set_id}/detail-1.jpg
    {generation_set_id}/detail-2.jpg
    {generation_set_id}/detail-3.jpg
    {generation_set_id}/seri.jpg
```

> Prefix `ai-studio/` dipakai supaya tidak bentrok dengan folder yang
> mungkin sudah ada di storage Deera untuk keperluan lain.

## Cloudinary (hasil final, setelah publish)

```text
deera/products/{product_kode}/
  ai-utama.jpg
  ai-detail-1.jpg
  ai-detail-2.jpg
  ai-detail-3.jpg
  ai-seri.jpg
```

URL Cloudinary hasil upload inilah yang ditulis ke
`products.image`/`products.detail`/`products.video` saat admin menekan
**Publish** (lihat §15).

---

# 14. UI Pages

## /login
Form login.

## /dashboard
Statistik sederhana (jumlah SKU diproses bulan ini, biaya generate akumulasi,
model aktif).

## /models
Manajemen model — buat/edit nama & thumbnail, aktivasi/nonaktifkan. Foto
pose dikelola di halaman terpisah (/poses), karena satu model bisa punya
banyak foto pose.

## /poses
Manajemen pose per model — upload foto pose (boleh dari arsip katalog
vendor lama), pilih model pemiliknya, edit nama/deskripsi.

## /presets
Manajemen background & aksesoris.

## /generate
Halaman utama generate — pilih model/pose/background/aksesoris, upload produk,
generate satu set foto.

## /history
Riwayat hasil, dikelompokkan per SKU/set. Ada tombol **Publish** per set
untuk mendorong gambar terpilih ke `products.image`/`detail`/`video` di
katalog Deera (lewat Cloudinary, lihat §13 & §15) — set yang sudah
dipublish ditandai jelas supaya tidak double-publish.

---

# 15. API Contract (MVP)

## POST /api/generate-set

Generate satu set foto (utama + detail + seri) untuk satu produk.

### Request
```json
{
  "modelId": "uuid",
  "poseId": "uuid",
  "backgroundPresetId": "uuid",
  "accessoryPresetIds": ["uuid"],
  "productKode": "D-07-OSK",
  "productImages": {
    "front": "https://...",
    "back": "https://...",
    "detailNeck": "https://...",
    "detailSleeve": "https://..."
  },
  "productWarna": "HITAM"
}
```
### Response
```json
{
  "generationSetId": "uuid",
  "status": "queued"
}
```

## GET /api/generation-sets/:id

### Response
```json
{
  "id": "uuid",
  "status": "completed",
  "images": [
    { "role": "utama", "url": "https://...", "status": "completed" },
    { "role": "detail", "url": "https://...", "status": "completed" },
    { "role": "detail", "url": "https://...", "status": "completed" },
    { "role": "detail", "url": "https://...", "status": "completed" },
    { "role": "seri", "url": "https://...", "status": "completed" }
  ],
  "totalCost": 9100
}
```

## POST /api/generations/:id/regenerate

Generate ulang satu gambar tertentu dalam sebuah set (tanpa mengulang
seluruh set).

## POST /api/generation-sets/:id/publish (baru v0.4)

Push gambar terpilih dari satu set ke katalog Deera — upload ke Cloudinary
lalu update `products.image`/`products.detail`/`products.video` untuk
`product_kode` terkait.

### Request
```json
{
  "imageIds": {
    "utama": "generation-uuid",
    "detail": ["generation-uuid", "generation-uuid", "generation-uuid"],
    "seri": "generation-uuid"
  }
}
```
### Response
```json
{
  "publishedAt": "2026-08-07T10:00:00Z",
  "cloudinaryUrls": {
    "image": "https://res.cloudinary.com/deera/.../ai-utama.jpg",
    "detail": ["https://...", "https://...", "https://..."]
  }
}
```

### Perilaku

* Hanya gambar dengan `status = 'completed'` yang bisa dipublish.
* Update `products.image` dan `products.detail` bersifat **overwrite** —
  admin diberi konfirmasi eksplisit sebelum menimpa foto lama, karena aksi
  ini mengubah data live yang dipakai `apps/catalog` (sesuai aturan
  `Explicit permission required` untuk perubahan data yang tampil publik).
* `generation_sets.published_at` dan `published_image_urls` diisi setelah
  sukses, sebagai jejak audit.

---

# 16. Error Handling

| Case                       | Message                             |
| --------------------------- | ------------------------------------ |
| File terlalu besar          | Maksimal 10 MB                       |
| Format tidak didukung       | Gunakan JPG atau PNG                 |
| Tahap 1 (VTO) gagal          | Gagal memakaikan produk, coba ulangi atau ganti foto model/produk |
| Tahap 2 (edit background) gagal | Background/aksesoris gagal diterapkan, foto tahap 1 tetap tersimpan sebagai fallback |
| AI timeout                  | Generate timeout, coba lagi          |
| Provider gagal               | AI service unavailable               |
| Budget bulan ini habis (opsional, kontrol internal) | Kuota generate bulan ini tercapai |

---

# 17. Security

* Semua halaman dilindungi auth.
* Storage bucket private.
* Signed URL untuk preview/download.
* API key Fal.ai hanya di server (server actions/route handlers), tidak pernah
  dikirim ke browser.
* **Baru v0.4 — karena database sama dengan Deera:** tabel baru (`models`,
  `poses`, `generation_sets`, dst) perlu RLS policy sendiri agar tidak
  mewarisi policy tabel Deera yang sudah ada secara tidak sengaja. Akses
  tulis ke `products` (saat publish) dibatasi lewat service role di server
  saja — Next.js AI Fashion Studio tidak boleh expose kemampuan ini ke
  client. Perlu review RLS existing Deera sebelum migration ditambahkan,
  supaya tidak mengubah perilaku `apps/admin`/`apps/pos`/`apps/finance`
  yang sudah berjalan.

---

# 18. Monitoring

* Sentry untuk error frontend/backend.
* Log generate disimpan di database (`generation_sets`, `generations`).
* Tracking durasi generate dan **biaya per set**, dipecah per tahap (VTO vs
  edit background/aksesoris) untuk kontrol budget bulanan.

---

# 19. Roadmap (revisi)

## V1 — MVP (2–3 minggu, lebih singkat dari v0.2 karena tanpa training LoRA)
* Migration tabel baru ke project Supabase Deera + RLS policy
* Auth (reuse Supabase Auth Deera)
* Model management (upload foto referensi, tanpa training)
* Pose management per model (seed dari arsip foto vendor lama)
* Upload produk (atau baca `products` existing dari Deera by kode)
* Generate 1 set foto (utama + 3 detail + seri) per produk — tahap 1 FLUX
  VTO wajib, tahap 2 edit background/aksesoris default aktif (mode Auto)
* Background library (15-20+ preset mewah) + mode AI Improvisasi +
  aksesoris (tas/kalung/cincin/anting; kerudung/heels auto-warna)
* History per SKU
* Download
* Publish ke katalog Deera (upload Cloudinary + update `products`)

## V2
* Video AI ("video cantik") — dipindah dari MVP ke sini, setelah workflow
  foto stabil dan budget bertambah.
* Batch generate
* Queue worker
* Email notification

## V3
* Auto QC AI
* Marketplace export
* Multi-size output (auto-resize per platform)

## V4
* Multi-model campaign
* Background bertema kampanye/musiman (mis. Lebaran, Ramadan) — perluasan
  dari mode Auto yang sudah jadi default sejak V1

---

# 20. Estimasi Biaya Operasional (revisi v0.5 — tahap 2 default aktif)

## Harga dasar Fal.ai (per Agustus 2026)

| Item | Harga | Sumber |
| --- | --- | --- |
| FLUX Virtual Try-On — tahap 1 (2 input + 1 output @1024px) | ~$0.0475/gambar (~Rp 760) | fal.ai/models/fal-ai/flux-pro/v1/vto |
| FLUX.1 Kontext Pro — tahap 2, edit background/aksesoris | $0.04/gambar (~Rp 640) | fal.ai/models/fal-ai/flux-pro/kontext |
| Nano Banana (Gemini 2.5 Flash Image) — alternatif tahap 2 | ~$0.039/gambar (~Rp 625) | pricepertoken.com/pricing-page/model/google-gemini-2.5-flash-image |

Tidak ada lagi biaya training model — dihapus sepenuhnya di v0.3 (lihat §9).

## Estimasi biaya per produk (5 gambar/set)

> **Revisi v0.5:** karena background bervariasi & mewah sekarang jadi
> default untuk *semua* produk (§7.4), skenario "hanya tahap 1" di v0.3/v0.4
> tidak lagi relevan sebagai kondisi normal — dianggap kasus khusus saja
> (mis. admin sengaja mau reuse background dari generate sebelumnya).

| Skenario | Biaya/gambar | Biaya/produk (5 gambar) |
| --- | --- | --- |
| **Normal (tahap 1 + tahap 2, default)** | ~Rp 1.820 (dengan buffer retry 1.3x) | **~Rp 9.100** |
| Kasus khusus: hanya tahap 1 (background di-reuse, tidak diedit) | ~Rp 990 (buffer 1.3x) | ~Rp 4.950 |

## Kapasitas dengan budget Rp 500.000/bulan

| Skenario | Kapasitas/bulan |
| --- | --- |
| **Normal — semua produk dapat background bervariasi (keputusan v0.5)** | **~55 SKU/bulan** |
| Kalau budget dinaikkan ke ~Rp 900.000/bulan | ~100 SKU/bulan dengan variasi penuh tetap terjaga |
| Kalau sebagian produk pakai background reuse (mis. hanya produk andalan yang dapat variasi penuh) | ~70–75 SKU/bulan dengan budget tetap Rp 500rb |

Karena tidak ada lagi biaya training LoRA yang memotong budget bulan
pertama (seperti di v0.2), kapasitas ini berlaku **sejak bulan pertama**,
bukan cuma di bulan kedua dst.

**Keputusan (v0.5):** Rp 500.000/bulan dengan kapasitas ~55 SKU/bulan
diterima sebagai baseline MVP — kualitas visual (background mewah &
bervariasi di setiap produk) diprioritaskan di atas volume. Budget bisa
dinaikkan belakangan kalau target volume perlu naik lagi.

## Biaya lain

| Item | Estimasi |
| --- | --- |
| ChatGPT Plus (opsional, bantu prompt engineering) | Rp 350.000 |
| Supabase | **Rp 0 tambahan** (revisi v0.4 — pakai project Deera yang sudah ada/dibayar, bukan project baru; kalau tabel baru mendorong Deera naik tier, itu biaya bersama, bukan biaya AI Studio sendiri) |
| Cloudinary | **Rp 0 tambahan** (pakai akun Cloudinary Deera yang sudah ada; perlu dipantau supaya kuota bulanan Cloudinary Deera tidak jebol karena tambahan gambar AI) |
| Domain | Rp 20.000 |

## Catatan penting

* Video AI **tidak termasuk** dalam estimasi ini — akan dihitung ulang saat
  masuk fase V2, karena biaya video (Kling ~$0.03–0.14/detik) signifikan lebih
  mahal per unit dibanding gambar.
* Spesifikasi komputer Denny (Intel i5-12400F, 16GB RAM, NVIDIA RTX 3060 Ti
  8GB VRAM, Windows 11) tidak memengaruhi biaya ini — semua proses AI berat
  berjalan di cloud Fal.ai, bukan di komputer lokal. GPU lokal ini sebenarnya
  cukup untuk menjalankan FLUX versi quantized secara mandiri (gratis, tapi
  jauh lebih lambat & perlu setup teknis ComfyUI) — opsi ini disimpan sebagai
  pertimbangan masa depan kalau volume produksi sudah sangat besar, bukan
  untuk MVP.

---

# 21. Definition of Done (MVP)

MVP dianggap selesai jika:
* Admin dapat login.
* Admin dapat upload foto model referensi (langsung siap pakai, tanpa
  training).
* Admin dapat upload pose, dan mengisi minimal 15-20 background preset +
  aksesoris preset (§7.4).
* Admin dapat upload produk (foto flat-lay).
* Generate berhasil menghasilkan **satu set foto lengkap** (utama + 3 detail +
  seri jika ada) dengan background bervariasi (mode Auto: preset atau
  improvisasi) dan warna kerudung/heels otomatis mengikuti warna produk.
* Hasil tersimpan di Supabase (project sama dengan Deera), dikelompokkan per SKU.
* Hasil dapat diunduh (per gambar atau seluruh set).
* Admin dapat publish set terpilih ke katalog Deera (Cloudinary +
  `products.image`/`detail`/`video`) dan melihat status publish di history.
* Riwayat generate tampil di dashboard, dikelompokkan per produk.
* Biaya generate tercatat per set untuk kontrol budget bulanan.

---

# 22. Keputusan (sebelumnya "Open Questions" di v0.1)

| Pertanyaan | Keputusan |
| --- | --- |
| Apakah satu produk boleh punya banyak output? | Ya — satu produk menghasilkan satu **set** (5 gambar: utama, 3 detail, seri). Riwayat dikelompokkan per SKU lewat `product_kode`. |
| Apakah perlu watermark otomatis? | Tidak untuk MVP — foto dipakai untuk upload sendiri ke marketplace, bukan dibagikan publik sebelum final. Bisa jadi opsi toggle di V2. |
| Apakah hasil langsung di-resize ke format marketplace? | Tidak untuk MVP — masuk roadmap V3 ("multi-size output"). |
| Apakah background hanya studio putih pada MVP? | **Direvisi dari v0.1** — background bervariasi lewat sistem preset (§7.4), disesuaikan gaya produk, bukan dikunci ke satu opsi. **Diperkuat lagi di v0.5**: karena tidak mau background "itu-itu saja", sistem sekarang punya library besar (15-20+ preset) + mode AI Improvisasi yang dicampur otomatis (mode Auto), bukan cuma 3 preset seperti draft awal. Konsekuensinya tahap 2 jadi default aktif untuk semua produk (lihat baris budget di bawah). |
| Apakah perlu approval sebelum hasil bisa diunduh? | Tidak untuk MVP — status `completed` sudah cukup sebagai sinyal siap unduh. Approval workflow butuh multi-user role yang di luar scope MVP. |
| Bagaimana menjaga wajah model konsisten? | **v0.2:** training LoRA per model. **Direvisi di v0.3** setelah riset — pakai FLUX VTO yang mempertahankan orang di foto input apa adanya, jadi cukup foto referensi biasa, tanpa training sama sekali. Lebih murah, lebih cepat setup. |
| Apakah video masuk MVP? | Tidak — ditunda ke V2 setelah workflow foto stabil dan budget bertambah. |
| Mesin AI mana yang dipakai untuk menjaga fidelitas produk? | **Baru di v0.3, hasil riset perbandingan** — FLUX Virtual Try-On (Black Forest Labs) dipakai sebagai mesin utama tahap 1, karena purpose-built untuk kasus ini (bukan model editing serba guna seperti Kontext Pro). FLUX Kontext Pro/Nano Banana jadi tahap 2 untuk background & aksesoris — **default aktif sejak v0.5** (semula opsional di v0.3/v0.4). Lihat §9. |
| Dari mana sumber foto pose untuk model AI, kalau tidak foto ulang? | **Baru, hasil diskusi** — pakai foto katalog lama dari vendor sebagai pose library awal, karena Deera punya hak pakai penuh atas foto-foto tersebut. Pose kini terikat per model (`poses.model_id`, lihat §7.3 & §12) karena FLUX VTO menyatukan identitas model dan pose dalam satu foto. Pose baru (real/AI-generated) hanya ditambah kalau perlu variasi di luar arsip lama. |
| 3 foto detail per produk — pakai foto asli atau digenerate AI? | **Baru, hasil diskusi** — tetap digenerate AI dengan model memakainya (bukan foto produk polos), supaya seluruh set konsisten satu gaya visual. Foto close-up asli tetap dipakai sebagai referensi tambahan ke FLUX VTO untuk menjaga presisi tekstur (§7.6). Admin disarankan review lebih teliti untuk produk dengan motif bordir sangat rapat. |
| Database tabel baru AI Fashion Studio ditaruh di mana? | **Baru v0.4, hasil diskusi** — di project Supabase Deera yang sudah ada (bukan project terpisah), karena data produk (kode, warna) memang perlu dipakai bersama dan hasil generate perlu dipush balik ke katalog Deera. `generation_sets.product_kode` jadi foreign key asli ke `products.kode`. Lihat §10 & §12. |
| Bagaimana cakupan aksesoris (kerudung, heels, cincin, tas, kalung, anting)? | **Baru v0.4, hasil diskusi** — kerudung & heels tetap otomatis mengikuti warna produk (tanpa pilihan gaya). Tas, kalung, cincin, anting jadi preset opsional berkategori yang bisa dipilih admin (`accessory_presets.category`). Lihat §7.4 & §12. |
| Background pakai library terkurasi, AI improvisasi, atau kombinasi? | **Baru v0.5, hasil diskusi** — kombinasi keduanya (mode Auto default): library 15-20+ preset mewah dengan auto-rotasi/matching, dicampur dengan mode AI Improvisasi (komposisi prompt dinamis dari material/mood/setting/warna, tanpa panggilan LLM tambahan). Lihat §7.4. |
| Tahap 2 jadi default aktif — bagaimana dengan kapasitas budget Rp 500rb/bulan? | **Baru v0.5, hasil diskusi** — diterima turun ke ~55 SKU/bulan (dari perkiraan 80-100 di v0.3/v0.4), sebagai keputusan sadar memprioritaskan kualitas visual di atas volume. Bisa naik lagi ke ~100 SKU/bulan kalau budget ditambah ke ~Rp 900rb/bulan. Lihat §3 & §20. |

---

# 23. Lampiran

## Naming Convention Produk

```text
AGM-001-front.jpg
AGM-001-back.jpg
AGM-001-detail-neck.jpg
AGM-001-detail-sleeve.jpg
```

## Naming Convention Pose

```text
POSE-01-front.png
POSE-02-walk.png
POSE-03-side.png
```

## Naming Convention Hasil Generate (baru)

```text
{generation_set_id}-utama.jpg
{generation_set_id}-detail-1.jpg
{generation_set_id}-detail-2.jpg
{generation_set_id}-detail-3.jpg
{generation_set_id}-seri.jpg
```
