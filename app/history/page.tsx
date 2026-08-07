"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Clock, Plus, RefreshCw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Label, Select } from "@/components/ui/Field";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Generation, GenerationSet, GenerationSetStatus } from "@/types/database";

// History — riwayat per SKU/set (PRD §7.7, §14). Publish push hasil terpilih
// ke katalog Deera lewat Cloudinary (PRD §15 v0.4).
type SetWithGenerations = GenerationSet & { ai_generations: Generation[] };

const STATUS_TONE: Record<GenerationSetStatus, "success" | "gold" | "danger" | "muted"> = {
  completed: "success",
  partial: "gold",
  processing: "gold",
  queued: "muted",
  failed: "danger",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [sets, setSets] = useState<SetWithGenerations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  // "+ Tambah Warna Seri" — nambah warna baru ke set yang SUDAH ADA tanpa
  // re-generate utama (lihat app/api/generation-sets/[id]/add-seri/route.ts).
  const [productWarnaOptions, setProductWarnaOptions] = useState<string[]>([]);
  const [addSeriWarna, setAddSeriWarna] = useState("");
  const [addSeriImage, setAddSeriImage] = useState<string | null>(null);
  const [addingSeri, setAddingSeri] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = (data as SetWithGenerations[]) ?? [];
    setSets(rows);
    if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = sets.find((s) => s.id === selectedId) ?? null;

  // Ambil daftar warna produk ini (products.warna) tiap kali pindah set —
  // dipakai buat dropdown "+ Tambah Warna Seri" di bawah, supaya admin milih
  // dari warna yang benar-benar terdaftar, bukan ketik manual (typo-prone).
  useEffect(() => {
    setAddSeriWarna("");
    setAddSeriImage(null);
    if (!selected) {
      setProductWarnaOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("warna")
        .eq("kode", selected.product_kode)
        .single();
      if (!cancelled) setProductWarnaOptions((data?.warna as string[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.product_kode]);

  // Warna yang belum punya baris "seri" di set ini & bukan warna utama —
  // itulah pilihan yang tersisa utk ditambahkan.
  const usedSeriWarna = new Set(
    (selected?.ai_generations ?? [])
      .filter((g) => g.image_role === "seri" && g.variant_warna)
      .map((g) => g.variant_warna as string)
  );
  const availableSeriWarna = productWarnaOptions.filter(
    (w) => w !== selected?.product_warna && !usedSeriWarna.has(w)
  );

  async function refreshOne(id: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .eq("id", id)
      .single();
    if (data) {
      setSets((prev) => prev.map((s) => (s.id === id ? (data as SetWithGenerations) : s)));
    }
  }

  async function handleRegenerate(genId: string) {
    if (!selected) return;
    setRegeneratingId(genId);
    try {
      const res = await fetch(`/api/generations/${genId}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Regenerate gagal");
      toast.success("Gambar berhasil digenerate ulang");
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regenerate gagal");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function handlePublish() {
    if (!selected) return;
    const utama = selected.ai_generations.find((g) => g.image_role === "utama");
    // "detail" (close-up) & "angle" (badan penuh pose lain) sama-sama masuk
    // slot products.detail — Deera belum punya kolom terpisah utk foto angle.
    const detail = selected.ai_generations.filter(
      (g) => g.image_role === "detail" || g.image_role === "angle"
    );
    // Bisa lebih dari satu warna seri per set (satu baris per warna varian).
    const seri = selected.ai_generations.filter((g) => g.image_role === "seri");

    if (!utama || utama.status !== "completed") {
      toast.error("Foto utama belum ada/gagal — tidak bisa publish");
      return;
    }
    if (detail.some((d) => d.status !== "completed")) {
      toast.error("Ada foto detail/angle yang belum selesai atau gagal");
      return;
    }
    if (seri.some((s) => s.status !== "completed")) {
      toast.error("Ada foto seri warna yang belum selesai atau gagal");
      return;
    }

    const ok = await confirmDialog({
      title: `Publish ke katalog Deera?`,
      description: `Ini akan menimpa foto produk "${selected.product_kode}" yang tampil publik di katalog Deera. Pastikan hasil sudah dicek dulu.`,
      confirmLabel: "Ya, publish",
      danger: true,
    });
    if (!ok) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageIds: {
            utama: utama.id,
            detail: detail.map((d) => d.id),
            seri: seri.map((s) => s.id),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Publish gagal");
      toast.success(`"${selected.product_kode}" berhasil dipublish ke katalog`);
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish gagal");
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddSeri() {
    if (!selected || !addSeriWarna || !addSeriImage) return;
    setAddingSeri(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/add-seri`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriEntries: [{ warna: addSeriWarna, image: addSeriImage }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Gagal tambah warna seri");
      }
      toast.success(`Warna "${addSeriWarna}" berhasil ditambahkan`);
      setAddSeriWarna("");
      setAddSeriImage(null);
      await refreshOne(selected.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal tambah warna seri");
    } finally {
      setAddingSeri(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Riwayat"
        title="History"
        description="Semua set foto yang pernah digenerate. Pilih satu untuk lihat detail, generate ulang gambar, atau publish ke katalog."
      />

      {loading ? (
        <p className="text-sm text-text-faint">Memuat...</p>
      ) : sets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Clock className="h-8 w-8 text-text-faint" />
          <p className="text-sm text-text-muted">Belum ada riwayat generate.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-2">
            {sets.map((set) => {
              const utama = set.ai_generations.find((g) => g.image_role === "utama");
              return (
                <button
                  key={set.id}
                  onClick={() => setSelectedId(set.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                    selectedId === set.id
                      ? "border-gold/60 bg-gold/5"
                      : "border-border bg-surface hover:border-border-strong"
                  )}
                >
                  <div className="h-14 w-11 shrink-0 overflow-hidden rounded bg-surface-2">
                    {utama?.output_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={utama.output_image_url}
                        alt={set.product_kode}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-text">{set.product_kode}</div>
                    <div className="text-xs text-text-faint">{formatDate(set.created_at)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={STATUS_TONE[set.status]}>{set.status}</Badge>
                    {set.published_at && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>{selected.product_kode}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[selected.status]}>{selected.status}</Badge>
                    {selected.published_at ? (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3 w-3" />
                        Published {formatDate(selected.published_at)}
                      </Badge>
                    ) : (
                      <Button size="sm" loading={publishing} onClick={handlePublish}>
                        <UploadCloud className="h-4 w-4" />
                        Publish ke Katalog
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="mb-4 text-sm text-text-muted">
                    Total biaya estimasi: Rp {selected.total_cost?.toLocaleString("id-ID") ?? "—"} ·
                    Dibuat {formatDate(selected.created_at)}
                  </p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {selected.ai_generations.map((gen) => (
                      <div
                        key={gen.id}
                        className="overflow-hidden rounded-lg border border-border bg-surface-2"
                      >
                        {gen.output_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={gen.output_image_url}
                            alt={gen.image_role}
                            className="aspect-[3/4] w-full object-cover"
                          />
                        ) : (
                          <div className="flex aspect-[3/4] w-full items-center justify-center text-xs text-text-faint">
                            {gen.status === "failed" ? "Gagal" : "..."}
                          </div>
                        )}
                        <div className="flex items-center justify-between p-2">
                          <div>
                            <div className="text-xs font-medium capitalize text-text">
                              {gen.image_role}
                              {gen.image_role === "seri" && gen.variant_warna && (
                                <span className="text-text-muted"> — {gen.variant_warna}</span>
                              )}
                            </div>
                            <div className="text-xs text-text-faint">{gen.status}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(gen.id)}
                            disabled={regeneratingId === gen.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-gold disabled:opacity-50"
                            title="Generate ulang"
                          >
                            <RefreshCw
                              className={cn("h-3.5 w-3.5", regeneratingId === gen.id && "animate-spin")}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {availableSeriWarna.length > 0 && (
                    <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
                      <p className="mb-2 text-xs font-medium text-text">+ Tambah Warna Seri</p>
                      <p className="mb-3 text-xs text-text-faint">
                        Reuse foto warna utama, pose, model &amp; background set ini — cukup
                        upload 1 foto full body warna baru, tidak perlu generate ulang utama.
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-40">
                          <Label htmlFor="add-seri-warna">Warna</Label>
                          <Select
                            id="add-seri-warna"
                            value={addSeriWarna}
                            onChange={(e) => setAddSeriWarna(e.target.value)}
                          >
                            <option value="">Pilih warna...</option>
                            {availableSeriWarna.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="w-28">
                          <ImageUploadField
                            label="Full Body"
                            folder="products"
                            value={addSeriImage}
                            onChange={setAddSeriImage}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          loading={addingSeri}
                          disabled={!addSeriWarna || !addSeriImage}
                          onClick={handleAddSeri}
                        >
                          <Plus className="h-4 w-4" />
                          Tambah
                        </Button>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </motion.div>
          )}
        </div>
      )}
    </AppShell>
  );
}
