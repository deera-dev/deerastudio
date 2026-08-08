"use client";
// Login — reuse Supabase Auth Deera (PRD §7.1), akun sama dengan admin.deera.id.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input, Label, FieldError } from "@/components/ui/Field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
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
        className="w-full max-w-sm rounded-xl border border-border bg-surface/90 p-8 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
