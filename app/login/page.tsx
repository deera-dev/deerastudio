"use client";
// Login — reuse Supabase Auth Deera (PRD §7.1), akun sama dengan admin.deera.id.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";

const EMAIL_DOMAIN = "deera.id";

export default function LoginPage() {
  const router = useRouter();
  // Semua akun yang bisa login WAJIB @deera.id — jadi field ini cuma nampung
  // bagian sebelum "@", domainnya otomatis ditempel pas submit (lihat
  // handleSubmit). Kalau admin paste email lengkap (ada "@"), bagian
  // domain-nya otomatis dibuang lagi lewat handleUsernameChange supaya tidak
  // dobel jadi "denny@deera.id@deera.id".
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleUsernameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setUsername(raw.includes("@") ? raw.split("@")[0] : raw);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const email = `${username.trim()}@${EMAIL_DOMAIN}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/55 p-8 shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_32px_64px_-28px_rgba(0,0,0,0.85)] backdrop-blur-2xl before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/[0.07] before:via-white/[0.015] before:to-transparent"
      >
        <div className="relative mb-6 flex flex-col items-center text-center">
          <Image
            src="/deera-logo-lg.png"
            alt="Deera Studio"
            width={240}
            height={240}
            className="mb-4 h-24 w-24 rounded-2xl"
            priority
          />
          <p className="mt-2 text-sm text-text-muted">
            Masuk pakai akun Deera yang sama (admin.deera.id).
          </p>
        </div>
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Username</Label>
            <div className="flex items-stretch">
              <Input
                id="email"
                type="text"
                autoComplete="username"
                value={username}
                onChange={handleUsernameChange}
                placeholder="denny"
                className="rounded-r-none border-r-0"
                required
              />
              <span className="flex items-center whitespace-nowrap rounded-r-md border border-l-0 border-border-strong bg-surface-2 px-3 text-sm text-text-faint">
                @{EMAIL_DOMAIN}
              </span>
            </div>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <FieldError>{error}</FieldError>}
          <Button type="submit" loading={loading} className="mt-2 w-full">
            Masuk
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
