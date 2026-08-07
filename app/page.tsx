import { redirect } from "next/navigation";

// Halaman utama tidak dipakai sebagai landing — langsung ke Dashboard.
// Middleware (lib/supabase/middleware.ts) akan redirect ke /login duluan
// kalau belum ada sesi.
export default function RootPage() {
  redirect("/dashboard");
}
