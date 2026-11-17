-- Dukung generate AI utk "sampel" (belum jadi produk, belum punya kode) —
-- persis sama alurnya dengan produk katalog, cuma identitasnya beda:
-- product_kode (produk katalog) ATAU sampel_id (sampel di tabel `sampel`,
-- project Supabase sama dgn Deera monorepo), tidak pernah dua-duanya.
alter table ai_generation_sets alter column product_kode drop not null;
alter table ai_generation_sets add column if not exists sampel_id uuid references sampel(id);
alter table ai_generation_sets add constraint ai_generation_sets_identity_xor
  check ((product_kode is not null) <> (sampel_id is not null));
comment on column ai_generation_sets.sampel_id is 'Dipakai saat generate AI utk sampel yang belum jadi produk (belum punya kode) — persis 1 dari product_kode/sampel_id yang terisi, tidak pernah dua-duanya.';
