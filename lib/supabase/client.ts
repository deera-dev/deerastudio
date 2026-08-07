// Supabase client untuk Client Components (browser).
// Project SAMA dengan Deera (packages/shared/lib/supabase.js di monorepo lama) —
// lihat PRD §10/§11. Env var wajib ada di .env.local (lihat .env.example).
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
