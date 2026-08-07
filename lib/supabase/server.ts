// Supabase client untuk Server Components / Server Actions / Route Handlers.
// Pakai cookies() Next.js supaya session Supabase Auth (akun Deera yang sama,
// lihat PRD §7.1) ikut terbawa di sisi server.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Dipanggil dari Server Component tanpa akses set cookie — aman diabaikan
            // kalau ada middleware yang refresh session.
          }
        },
      },
    }
  );
}

// Service-role client — HANYA dipakai di server (route handler/server action),
// TIDAK PERNAH diimpor ke Client Component. Dipakai untuk aksi yang butuh
// bypass RLS, mis. publish hasil generate ke products.image/detail/video
// (PRD §15, §17 — server-only by design).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
