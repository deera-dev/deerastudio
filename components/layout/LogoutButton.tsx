"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  iconOnly,
}: {
  className?: string;
  // Dipakai di rail ikon desktop (AppShell) — cuma ikon, bulat, tanpa teks,
  // konsisten dgn tombol nav lain di rail.
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        title="Keluar"
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50",
          className
        )}
      >
        <LogOut className="h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50",
        className
      )}
    >
      <LogOut className="h-4 w-4" />
      Keluar
    </button>
  );
}
