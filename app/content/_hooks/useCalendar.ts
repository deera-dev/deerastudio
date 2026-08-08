"use client";
// Kalender Konten Bulanan — generate banyak draft sekaligus tersebar 1
// bulan, rotasi produk x tema. Semua tetap draft, admin review manual.
import { useState } from "react";
import { toast } from "sonner";

export function useCalendar(onGenerated: () => void) {
  const now = new Date();
  const [monthStart, setMonthStart] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
  );
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);

  async function handleGenerateCalendar() {
    setGeneratingCalendar(true);
    try {
      const res = await fetch("/api/content/generate-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthStart, postsPerWeek }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate kalender gagal");
      const createdCount = data.created?.length ?? 0;
      const failedCount = data.failed?.length ?? 0;
      toast.success(`${createdCount} draft konten dibuat${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`);
      onGenerated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate kalender gagal");
    } finally {
      setGeneratingCalendar(false);
    }
  }

  return { monthStart, setMonthStart, postsPerWeek, setPostsPerWeek, generatingCalendar, handleGenerateCalendar };
}
