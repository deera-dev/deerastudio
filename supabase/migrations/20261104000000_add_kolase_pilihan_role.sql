-- "Kolase 2 Foto" (November 2026) — admin: "saya mau nambah fitur collase
-- atau foto grid dimana bisa bikin 2 foto bergabung jadi 1, rencananya
-- seperti menggabungkan foto tampak depan dan tampak belakang buat di
-- share ke langganan, atau foto tampak depan dengan foto seri warna
-- lengkap". Fitur ini BEBAS pilih 2 foto apa saja dari hasil generate
-- produk (lihat app/api/generation-sets/[id]/collage/route.ts), beda dari
-- "kolase_gabungan" yang sumbernya FIXED (utama+angle, otomatis saat
-- generate-set). Admin bisa bikin lebih dari 1 kolase per set (pasangan
-- foto beda-beda), jadi role ini TIDAK unique per set seperti kolase_warna
-- — mengikuti pola "seri" yang juga boleh berbaris banyak per set.
--
-- CATATAN: constraint ai_generations_image_role_check yang hidup di DB
-- saat ini sudah lebih lengkap dari migration init
-- (20260807000000_ai_fashion_studio_init.sql hanya list 'utama','detail',
-- 'seri') — kolom 'angle','kolase_gabungan','kolase_detail','kolase_warna'
-- sudah ditambah di sesi-sesi sebelumnya tanpa migration file tertulis
-- (lihat catatan di app/api/generations/[id]/regenerate/route.ts soal bug
-- ini pernah kejadian: constraint lupa di-update, insert 400). Definisi di
-- bawah ini mereplikasi persis constraint yang HIDUP di database + 1 value
-- baru, bukan menebak dari migration lama.
alter table public.ai_generations drop constraint ai_generations_image_role_check;
alter table public.ai_generations add constraint ai_generations_image_role_check
  check (image_role = any (array[
    'utama'::text,
    'detail'::text,
    'seri'::text,
    'angle'::text,
    'kolase_gabungan'::text,
    'kolase_detail'::text,
    'kolase_warna'::text,
    'kolase_pilihan'::text
  ]));
