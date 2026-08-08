"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { createClient } from "@/lib/supabase/client";
import type { AiModel, AiPose } from "@/types/database";

// Poses — terikat ke model_id (PRD §7.3 v0.3). Boleh diisi dari arsip foto
// katalog vendor lama (Deera punya hak pakai penuh, sudah dikonfirmasi).
const SOURCE_OPTIONS: { value: AiPose["source"]; label: string }[] = [
  { value: "vendor_archive", label: "Arsip vendor lama" },
  { value: "new_shoot", label: "Foto baru" },
  { value: "ai_generated", label: "Hasil AI" },
];

export default function PosesPage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [poses, setPoses] = useState<AiPose[]>([]);
  const [loadingPoses, setLoadingPoses] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<AiPose["source"]>("vendor_archive");
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadModels() {
      const supabase = createClient();
      const { data } = await supabase
        .from("ai_models")
        .select("*")
        .eq("is_active", true)
        .order("name");
      const rows = (data as AiModel[]) ?? [];
      setModels(rows);
      if (rows.length > 0) setSelectedModelId(rows[0].id);
    }
    loadModels();
  }, []);

  async function loadPoses(modelId: string) {
    if (!modelId) {
      setPoses([]);
      return;
    }
    setLoadingPoses(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_poses")
      .select("*")
      .eq("model_id", modelId)
      .order("created_at", { ascending: false });
    setPoses((data as AiPose[]) ?? []);
    setLoadingPoses(false);
  }

  useEffect(() => {
    loadPoses(selectedModelId);
  }, [selectedModelId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModelId || !name.trim() || !referenceUrl) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("ai_poses").insert({
      model_id: selectedModelId,
      name: name.trim(),
      description: description.trim() || null,
      source,
      reference_image_url: referenceUrl,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Pose "${name.trim()}" ditambahkan`);
    setName("");
    setDescription("");
    setSource("vendor_archive");
    setReferenceUrl(null);
    loadPoses(selectedModelId);
  }

  async function toggleActive(pose: AiPose) {
    const supabase = createClient();
    await supabase.from("ai_poses").update({ is_active: !pose.is_active }).eq("id", pose.id);
    loadPoses(selectedModelId);
  }

  async function handleDelete(pose: AiPose) {
    const ok = await confirmDialog({
      title: `Hapus pose "${pose.name}"?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("ai_poses").delete().eq("id", pose.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pose dihapus");
    loadPoses(selectedModelId);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Referensi Pose"
        title="Poses"
        description="Setiap pose terikat ke satu model. Foto pose dipakai sebagai input Virtual Try-On (FLUX VTO) — boleh diisi dari arsip foto vendor lama karena Deera punya hak pakai penuh."
      />

      <div className="mb-6 max-w-xs">
        <Label htmlFor="pose-model">Model</Label>
        {models.length === 0 ? (
          <p className="text-sm text-text-faint">Belum ada model — tambah dulu di halaman Models.</p>
        ) : (
          <Select
            id="pose-model"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {selectedModelId && (
        // REVISI Agustus 2026 v2 (feedback admin: "column base") — form &
        // daftar pose stack vertikal full-width, bukan sidebar+main lagi.
        <div className="flex flex-col gap-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Tambah Pose</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="pose-name">Nama Pose</Label>
                  <Input
                    id="pose-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Berdiri depan, tangan di pinggang"
                  />
                </div>
                <div>
                  <Label htmlFor="pose-source">Sumber Foto</Label>
                  <Select
                    id="pose-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value as AiPose["source"])}
                  >
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pose-desc">Catatan (opsional)</Label>
                  <Textarea
                    id="pose-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="mis. cocok untuk produk gamis longgar"
                    rows={2}
                  />
                </div>
                <ImageUploadField
                  label="Foto Referensi Pose"
                  folder="poses"
                  value={referenceUrl}
                  onChange={setReferenceUrl}
                  required
                />
                <Button type="submit" loading={saving} disabled={!name.trim() || !referenceUrl}>
                  <Plus className="h-4 w-4" />
                  Tambah Pose
                </Button>
              </form>
            </CardBody>
          </Card>

          <div>
            {loadingPoses ? (
              <p className="text-sm text-text-faint">Memuat...</p>
            ) : poses.length === 0 ? (
              <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Camera className="h-8 w-8 text-text-faint" />
                <p className="text-sm text-text-muted">Belum ada pose untuk model ini.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {poses.map((pose, i) => (
                  <motion.div
                    key={pose.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                  >
                    <Card className="overflow-hidden">
                      <div className="aspect-[3/4] w-full bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pose.reference_image_url}
                          alt={pose.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <CardBody>
                        <div className="mb-1 font-medium text-text">{pose.name}</div>
                        <div className="mb-2 text-xs text-text-faint">
                          {SOURCE_OPTIONS.find((o) => o.value === pose.source)?.label}
                        </div>
                        {pose.description && (
                          <p className="mb-3 text-xs text-text-muted">{pose.description}</p>
                        )}
                        <div className="mb-3">
                          <Badge tone={pose.is_active ? "success" : "muted"}>
                            {pose.is_active ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => toggleActive(pose)}>
                            {pose.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleDelete(pose)}>
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
      )}
    </AppShell>
  );
}
