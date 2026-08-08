"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import type { AiModel } from "@/types/database";

// Models — CRUD model AI, tanpa training (PRD §7.2 v0.3). Foto pose
// dikelola terpisah di /poses karena satu model bisa punya banyak pose.
export default function ModelsPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadModels() {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("ai_models")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setModels(data as AiModel[]);
    setLoading(false);
  }

  useEffect(() => {
    loadModels();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("ai_models").insert({
      name: name.trim(),
      thumbnail_url: thumbnailUrl,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Model "${name.trim()}" ditambahkan`);
    setName("");
    setThumbnailUrl(null);
    loadModels();
  }

  async function toggleActive(model: AiModel) {
    const supabase = createClient();
    await supabase.from("ai_models").update({ is_active: !model.is_active }).eq("id", model.id);
    loadModels();
  }

  async function handleDelete(model: AiModel) {
    const ok = await confirmDialog({
      title: `Hapus model "${model.name}"?`,
      description: "Pose yang terikat ke model ini ikut terhapus. Tindakan ini tidak bisa dibatalkan.",
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("ai_models").delete().eq("id", model.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Model dihapus");
    loadModels();
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Referensi Model"
        title="Models"
        description="Model AI dipakai bareng pose (halaman Poses) sebagai referensi wajah & tubuh yang konsisten untuk hasil Virtual Try-On. Tidak perlu training — cukup nama + thumbnail."
      />

      {/* REVISI Agustus 2026 v2 (feedback admin: "column base") — form &
          daftar model stack vertikal full-width, bukan sidebar+main lagi. */}
      <div className="flex flex-col gap-6">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tambah Model</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="model-name">Nama Model</Label>
                <Input
                  id="model-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Model A"
                />
              </div>
              <ImageUploadField
                label="Thumbnail"
                folder="models"
                value={thumbnailUrl}
                onChange={setThumbnailUrl}
                aspect="aspect-square"
              />
              <Button type="submit" loading={saving} disabled={!name.trim()}>
                <Plus className="h-4 w-4" />
                Tambah Model
              </Button>
            </form>
          </CardBody>
        </Card>

        <div>
          {loading ? (
            <p className="text-sm text-text-faint">Memuat...</p>
          ) : models.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <UserRound className="h-8 w-8 text-text-faint" />
              <p className="text-sm text-text-muted">
                Belum ada model. Tambah model baru untuk mulai upload foto pose.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {models.map((model, i) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <Card className="overflow-hidden">
                    <div className="aspect-square w-full bg-surface-2">
                      {model.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={model.thumbnail_url}
                          alt={model.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <UserRound className="h-8 w-8 text-text-faint" />
                        </div>
                      )}
                    </div>
                    <CardBody>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="font-medium text-text">{model.name}</span>
                        <Badge tone={model.is_active ? "success" : "muted"}>
                          {model.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleActive(model)}>
                          {model.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(model)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
