-- Lepas hubungan "generate sampel" dari tabel `sampel` (Planning Repeat
-- admin) — admin: "itu mah sampel planing, ga ada hubungannya". sampel_id
-- (FK ke sampel) diganti sampel_nomor (text bebas, di-generate OTOMATIS
-- server-side saat submit generate, BUKAN dipilih dari sampel planning yang
-- sudah ada). Backfill dulu baris yang sempat dites pakai sampel_id (4 baris
-- production, lihat query sebelum migrasi ini) supaya tidak melanggar
-- constraint XOR begitu sampel_id dihapus.
alter table ai_generation_sets add column if not exists sampel_nomor text;

update ai_generation_sets gs
set sampel_nomor = (select nomor from sampel s where s.id = gs.sampel_id)
where gs.sampel_id is not null and gs.sampel_nomor is null;

alter table ai_generation_sets drop constraint if exists ai_generation_sets_identity_xor;
alter table ai_generation_sets drop column if exists sampel_id;

alter table ai_generation_sets add constraint ai_generation_sets_identity_xor
  check ((product_kode is not null) <> (sampel_nomor is not null));

comment on column ai_generation_sets.sampel_nomor is 'Label unik utk set generate yang belum punya kode produk (mode "Sampel (belum ada kode)" di /generate) — di-generate OTOMATIS server-side saat submit (app/api/generate-set/route.ts), TIDAK terhubung ke tabel sampel (Planning Repeat admin, konsep terpisah, lihat diskusi Nov 2026). Persis 1 dari product_kode/sampel_nomor yang terisi, tidak pernah dua-duanya (lihat constraint ai_generation_sets_identity_xor).';
