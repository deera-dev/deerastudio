-- AI Fashion Studio — migration awal (PRD v0.5 §12)
-- Ditambahkan ke project Supabase DEERA YANG SUDAH ADA (bukan project baru),
-- lihat PRD §10. Tabel Deera existing (products, stok_warna, dst) TIDAK
-- disentuh migration ini — hanya dibaca lewat foreign key ke products.kode.
--
-- PENTING: review RLS policy di bawah sebelum apply ke production — policy
-- ini baseline "authenticated user penuh akses", sesuaikan kalau Deera sudah
-- punya konvensi role/policy yang lebih spesifik (lihat PRD §17).

-- ============================================================
-- models — tanpa training LoRA (v0.3), cukup foto referensi
-- ============================================================
create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  thumbnail_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.ai_models is
  'AI Fashion Studio — model AI (tanpa LoRA training, PRD v0.3 §7.2). Prefix ai_ untuk hindari bentrok nama dgn tabel Deera lain.';

-- ============================================================
-- poses — terikat ke model_id (v0.3), boleh diisi dari arsip vendor lama
-- ============================================================
create table if not exists public.ai_poses (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.ai_models(id) on delete cascade,
  name text not null,
  reference_image_url text not null,
  description text,
  source text not null default 'vendor_archive'
    check (source in ('vendor_archive', 'new_shoot', 'ai_generated')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_poses_model_id_idx on public.ai_poses(model_id);

-- ============================================================
-- background_presets — library terkurasi (target 15-20+, v0.5)
-- ============================================================
create table if not exists public.ai_background_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt_fragment text not null,
  reference_image_url text,
  mood_tags jsonb not null default '[]'::jsonb,
  warna_affinity jsonb not null default '[]'::jsonb,
  cocok_untuk_kategori jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  use_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- accessory_presets — berkategori (v0.4): tas, kalung, cincin, anting
-- Kerudung & heels TIDAK punya preset — warna otomatis dari products.warna
-- ============================================================
create table if not exists public.ai_accessory_presets (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('tas', 'kalung', 'cincin', 'anting')),
  name text not null,
  prompt_fragment text not null,
  reference_image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- generation_sets — 1 produk = 1 set (5 gambar), product_kode FK ASLI (v0.4)
-- ============================================================
create table if not exists public.ai_generation_sets (
  id uuid primary key default gen_random_uuid(),
  product_kode text not null references public.products(kode),
  model_id uuid references public.ai_models(id),
  pose_id uuid references public.ai_poses(id),
  background_mode text not null default 'auto'
    check (background_mode in ('auto', 'preset', 'ai_improvised')),
  background_preset_id uuid references public.ai_background_presets(id),
  background_description text,
  accessory_preset_ids jsonb not null default '[]'::jsonb,
  product_images jsonb not null,
  product_warna text,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'partial', 'failed')),
  total_cost integer,
  published_at timestamptz,
  published_image_urls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_generation_sets_product_kode_idx on public.ai_generation_sets(product_kode);
create index if not exists ai_generation_sets_status_idx on public.ai_generation_sets(status);

-- ============================================================
-- generations — child dari generation_sets, dua tahap (VTO + edit) (v0.3/v0.5)
-- ============================================================
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  generation_set_id uuid not null references public.ai_generation_sets(id) on delete cascade,
  image_role text not null check (image_role in ('utama', 'detail', 'seri')),
  vto_image_url text,
  output_image_url text,
  has_stage2 boolean not null default false,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  generation_time_ms integer,
  cost integer,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists ai_generations_set_id_idx on public.ai_generations(generation_set_id);

-- ============================================================
-- RLS — baseline: authenticated user (akun Deera yg sama, §7.1) full akses.
-- Service role (dipakai server-only saat publish, §17) otomatis bypass RLS.
-- ============================================================
alter table public.ai_models enable row level security;
alter table public.ai_poses enable row level security;
alter table public.ai_background_presets enable row level security;
alter table public.ai_accessory_presets enable row level security;
alter table public.ai_generation_sets enable row level security;
alter table public.ai_generations enable row level security;

create policy "authenticated_full_access" on public.ai_models
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on public.ai_poses
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on public.ai_background_presets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on public.ai_accessory_presets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on public.ai_generation_sets
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated_full_access" on public.ai_generations
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
