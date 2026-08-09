"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ImageIcon, Palette, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { AccessoryCategory, AccessoryPresetRow, BackgroundPresetRow } from "@/types/database";

// Presets — background_presets (target 15-20+, PRD §12 v0.5) dan
// accessory_presets berkategori (tas/kalung/cincin/anting, PRD §7.4 v0.4).
//
// REVISI Agustus 2026 v2:
// 1. Upload foto referensi di kedua form "Tambah Preset" sebelumnya
//    full-width (RAKSASA di layar sempit) — sekarang dikecilkan & ditaruh
//    kiri (flex-between, permintaan admin).
// 2. Preset yang sudah dibuat (termasuk 18 preset background yang
//    di-seed lewat SQL TANPA foto sama sekali — makanya kartu-kartunya
//    cuma nampilin ikon placeholder, admin bingung "kira-kira bentuknya
//    kayak apa") sebelumnya TIDAK BISA diedit sama sekali. Sekarang
//    ditambah mode edit inline per-card supaya admin bisa isi/ganti foto
//    referensi (atau field lain) kapan saja tanpa hapus-buat-ulang.
const ACCESSORY_CATEGORIES: { value: AccessoryCategory; label: string }[] = [
  { value: "tas", label: "Tas" },
  { value: "kalung", label: "Kalung" },
  { value: "cincin", label: "Cincin" },
  { value: "anting", label: "Anting" },
];

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function PresetsPage() {
  const [tab, setTab] = useState<"background" | "accessory">("background");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Perpustakaan Gaya"
        title="Presets"
        description="Kelola preset background & aksesoris yang dipakai halaman Generate. Preset aktif dirotasi otomatis supaya tidak berulang dalam 24 jam terakhir."
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {(
          [
            { key: "background", label: "Background", icon: Palette },
            { key: "accessory", label: "Aksesoris", icon: ImageIcon },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 text-sm transition-colors",
              tab === t.key ? "text-gold" : "text-text-muted hover:text-text"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {tab === t.key && (
              <motion.span
                layoutId="preset-tab"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-gold"
              />
            )}
          </button>
        ))}
      </div>

      {tab === "background" ? <BackgroundPresetsSection /> : <AccessoryPresetsSection />}
    </AppShell>
  );
}

function BackgroundPresetsSection() {
  const [presets, setPresets] = useState<BackgroundPresetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [promptFragment, setPromptFragment] = useState("");
  const [moodTags, setMoodTags] = useState("");
  const [warnaAffinity, setWarnaAffinity] = useState("");
  const [kategori, setKategori] = useState("");
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPromptFragment, setEditPromptFragment] = useState("");
  const [editMoodTags, setEditMoodTags] = useState("");
  const [editWarnaAffinity, setEditWarnaAffinity] = useState("");
  const [editKategori, setEditKategori] = useState("");
  const [editReferenceUrl, setEditReferenceUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("ai_background_presets").select("*").order("name");
    setPresets((data as BackgroundPresetRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !promptFragment.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("ai_background_presets").insert({
      name: name.trim(),
      prompt_fragment: promptFragment.trim(),
      reference_image_url: referenceUrl,
      mood_tags: parseTags(moodTags),
      warna_affinity: parseTags(warnaAffinity),
      cocok_untuk_kategori: parseTags(kategori),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Preset "${name.trim()}" ditambahkan`);
    setName("");
    setPromptFragment("");
    setMoodTags("");
    setWarnaAffinity("");
    setKategori("");
    setReferenceUrl(null);
    load();
  }

  async function toggleActive(preset: BackgroundPresetRow) {
    const supabase = createClient();
    await supabase
      .from("ai_background_presets")
      .update({ is_active: !preset.is_active })
      .eq("id", preset.id);
    load();
  }

  async function handleDelete(preset: BackgroundPresetRow) {
    const ok = await confirmDialog({
      title: `Hapus preset "${preset.name}"?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("ai_background_presets").delete().eq("id", preset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Preset dihapus");
    load();
  }

  function startEdit(preset: BackgroundPresetRow) {
    setEditingId(preset.id);
    setEditName(preset.name);
    setEditPromptFragment(preset.prompt_fragment);
    setEditMoodTags(preset.mood_tags.join(", "));
    setEditWarnaAffinity(preset.warna_affinity.join(", "));
    setEditKategori(preset.cocok_untuk_kategori.join(", "));
    setEditReferenceUrl(preset.reference_image_url);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(preset: BackgroundPresetRow) {
    if (!editName.trim() || !editPromptFragment.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ai_background_presets")
      .update({
        name: editName.trim(),
        prompt_fragment: editPromptFragment.trim(),
        reference_image_url: editReferenceUrl,
        mood_tags: parseTags(editMoodTags),
        warna_affinity: parseTags(editWarnaAffinity),
        cocok_untuk_kategori: parseTags(editKategori),
      })
      .eq("id", preset.id);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Preset diperbarui");
    setEditingId(null);
    load();
  }

  const activeCount = presets.filter((p) => p.is_active).length;

  return (
    // REVISI Agustus 2026 v2 (feedback admin: "column base") — form &
    // daftar preset stack vertikal full-width, bukan sidebar+main lagi.
    <div className="flex flex-col gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Tambah Preset Background</CardTitle>
        </CardHeader>
        <CardBody>
          {/* REVISI v2: upload dikecilkan & ditaruh kiri (flex-between). */}
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div className="w-full sm:w-56 sm:shrink-0">
                <ImageUploadField
                  label="Foto referensi"
                  folder="background-presets"
                  value={referenceUrl}
                  onChange={setReferenceUrl}
                  aspect="aspect-video"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <Label htmlFor="bg-name">Nama</Label>
                  <Input
                    id="bg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Lounge Butik Marmer Emas"
                  />
                </div>
                <div>
                  <Label htmlFor="bg-prompt">Deskripsi (dipakai sebagai prompt)</Label>
                  <Textarea
                    id="bg-prompt"
                    value={promptFragment}
                    onChange={(e) => setPromptFragment(e.target.value)}
                    placeholder="mis. lounge butik mewah dengan lantai marmer putih urat emas, pencahayaan golden hour yang hangat"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="bg-mood">Mood tags</Label>
                  <Input
                    id="bg-mood"
                    value={moodTags}
                    onChange={(e) => setMoodTags(e.target.value)}
                    placeholder="hangat, mewah"
                  />
                  <FieldHint>Pisahkan dengan koma</FieldHint>
                </div>
                <div>
                  <Label htmlFor="bg-warna">Cocok warna produk</Label>
                  <Input
                    id="bg-warna"
                    value={warnaAffinity}
                    onChange={(e) => setWarnaAffinity(e.target.value)}
                    placeholder="HITAM, MAROON, NAVY"
                  />
                </div>
                <div>
                  <Label htmlFor="bg-kategori">Kategori</Label>
                  <Input
                    id="bg-kategori"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    placeholder="gamis, syari"
                  />
                </div>
              </div>
            </div>
            <Button type="submit" loading={saving} disabled={!name.trim() || !promptFragment.trim()}>
              <Plus className="h-4 w-4" />
              Tambah Preset
            </Button>
          </form>
        </CardBody>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-text">Daftar Preset</h2>
          <Badge tone={activeCount >= 15 ? "success" : "gold"}>
            {activeCount} aktif dari {presets.length} · target 15-20
          </Badge>
        </div>
        {loading ? (
          <p className="text-sm text-text-faint">Memuat...</p>
        ) : presets.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Palette className="h-8 w-8 text-text-faint" />
            <p className="text-sm text-text-muted">Belum ada preset background.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset, i) => {
              const isEditing = editingId === preset.id;
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Card className="overflow-hidden">
                    {isEditing ? (
                      <CardBody className="flex flex-col gap-3">
                        <div className="w-full">
                          <ImageUploadField
                            label="Foto referensi"
                            folder="background-presets"
                            value={editReferenceUrl}
                            onChange={setEditReferenceUrl}
                            aspect="aspect-video"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-bg-name-${preset.id}`}>Nama</Label>
                          <Input
                            id={`edit-bg-name-${preset.id}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-bg-prompt-${preset.id}`}>Deskripsi</Label>
                          <Textarea
                            id={`edit-bg-prompt-${preset.id}`}
                            value={editPromptFragment}
                            onChange={(e) => setEditPromptFragment(e.target.value)}
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-bg-mood-${preset.id}`}>Mood tags</Label>
                          <Input
                            id={`edit-bg-mood-${preset.id}`}
                            value={editMoodTags}
                            onChange={(e) => setEditMoodTags(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-bg-warna-${preset.id}`}>Cocok warna produk</Label>
                          <Input
                            id={`edit-bg-warna-${preset.id}`}
                            value={editWarnaAffinity}
                            onChange={(e) => setEditWarnaAffinity(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-bg-kategori-${preset.id}`}>Kategori</Label>
                          <Input
                            id={`edit-bg-kategori-${preset.id}`}
                            value={editKategori}
                            onChange={(e) => setEditKategori(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            loading={savingEdit}
                            disabled={!editName.trim() || !editPromptFragment.trim()}
                            onClick={() => saveEdit(preset)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Simpan
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                            Batal
                          </Button>
                        </div>
                      </CardBody>
                    ) : (
                      <>
                        {preset.reference_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preset.reference_image_url}
                            alt={preset.name}
                            className="h-28 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-28 w-full items-center justify-center bg-surface-2">
                            <Palette className="h-6 w-6 text-text-faint" />
                          </div>
                        )}
                        <CardBody>
                          <div className="mb-1 font-medium text-text">{preset.name}</div>
                          <p className="mb-2 line-clamp-2 text-xs text-text-muted">
                            {preset.prompt_fragment}
                          </p>
                          {preset.warna_affinity.length > 0 && (
                            <p className="mb-3 text-xs text-text-faint">
                              Warna: {preset.warna_affinity.join(", ")}
                            </p>
                          )}
                          <div className="mb-3 flex items-center gap-2">
                            <Badge tone={preset.is_active ? "success" : "muted"}>
                              {preset.is_active ? "Aktif" : "Nonaktif"}
                            </Badge>
                            <span className="text-xs text-text-faint">dipakai {preset.use_count}x</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => toggleActive(preset)}>
                              {preset.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => startEdit(preset)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(preset)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardBody>
                      </>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AccessoryPresetsSection() {
  const [presets, setPresets] = useState<AccessoryPresetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState<AccessoryCategory>("tas");
  const [name, setName] = useState("");
  const [promptFragment, setPromptFragment] = useState("");
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<AccessoryCategory>("tas");
  const [editName, setEditName] = useState("");
  const [editPromptFragment, setEditPromptFragment] = useState("");
  const [editReferenceUrl, setEditReferenceUrl] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_accessory_presets")
      .select("*")
      .order("category")
      .order("name");
    setPresets((data as AccessoryPresetRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !promptFragment.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("ai_accessory_presets").insert({
      category,
      name: name.trim(),
      prompt_fragment: promptFragment.trim(),
      reference_image_url: referenceUrl,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Preset "${name.trim()}" ditambahkan`);
    setName("");
    setPromptFragment("");
    setReferenceUrl(null);
    load();
  }

  async function toggleActive(preset: AccessoryPresetRow) {
    const supabase = createClient();
    await supabase
      .from("ai_accessory_presets")
      .update({ is_active: !preset.is_active })
      .eq("id", preset.id);
    load();
  }

  async function handleDelete(preset: AccessoryPresetRow) {
    const ok = await confirmDialog({
      title: `Hapus preset "${preset.name}"?`,
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from("ai_accessory_presets").delete().eq("id", preset.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Preset dihapus");
    load();
  }

  function startEdit(preset: AccessoryPresetRow) {
    setEditingId(preset.id);
    setEditCategory(preset.category);
    setEditName(preset.name);
    setEditPromptFragment(preset.prompt_fragment);
    setEditReferenceUrl(preset.reference_image_url);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(preset: AccessoryPresetRow) {
    if (!editName.trim() || !editPromptFragment.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("ai_accessory_presets")
      .update({
        category: editCategory,
        name: editName.trim(),
        prompt_fragment: editPromptFragment.trim(),
        reference_image_url: editReferenceUrl,
      })
      .eq("id", preset.id);
    setSavingEdit(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Preset diperbarui");
    setEditingId(null);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Tambah Preset Aksesoris</CardTitle>
        </CardHeader>
        <CardBody>
          {/* REVISI v2: upload dikecilkan & ditaruh kiri (flex-between). */}
          <form onSubmit={handleAdd} className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div className="w-full sm:w-40 sm:shrink-0">
                <ImageUploadField
                  label="Foto referensi"
                  folder="accessory-presets"
                  value={referenceUrl}
                  onChange={setReferenceUrl}
                  aspect="aspect-square"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <Label htmlFor="acc-category">Kategori</Label>
                  <Select
                    id="acc-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AccessoryCategory)}
                  >
                    {ACCESSORY_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="acc-name">Nama</Label>
                  <Input
                    id="acc-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="mis. Clutch Beludru Emas"
                  />
                </div>
                <div>
                  <Label htmlFor="acc-prompt">Deskripsi (dipakai sebagai prompt)</Label>
                  <Textarea
                    id="acc-prompt"
                    value={promptFragment}
                    onChange={(e) => setPromptFragment(e.target.value)}
                    placeholder="mis. clutch kecil beludru hitam dengan aksen rantai emas"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <Button type="submit" loading={saving} disabled={!name.trim() || !promptFragment.trim()}>
              <Plus className="h-4 w-4" />
              Tambah Preset
            </Button>
          </form>
        </CardBody>
      </Card>

      <div>
        {loading ? (
          <p className="text-sm text-text-faint">Memuat...</p>
        ) : presets.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <ImageIcon className="h-8 w-8 text-text-faint" />
            <p className="text-sm text-text-muted">Belum ada preset aksesoris.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset, i) => {
              const isEditing = editingId === preset.id;
              return (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.3) }}
                >
                  <Card className="overflow-hidden">
                    {isEditing ? (
                      <CardBody className="flex flex-col gap-3">
                        <div className="w-32">
                          <ImageUploadField
                            label="Foto referensi"
                            folder="accessory-presets"
                            value={editReferenceUrl}
                            onChange={setEditReferenceUrl}
                            aspect="aspect-square"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-acc-category-${preset.id}`}>Kategori</Label>
                          <Select
                            id={`edit-acc-category-${preset.id}`}
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as AccessoryCategory)}
                          >
                            {ACCESSORY_CATEGORIES.map((c) => (
                              <option key={c.value} value={c.value}>
                                {c.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`edit-acc-name-${preset.id}`}>Nama</Label>
                          <Input
                            id={`edit-acc-name-${preset.id}`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-acc-prompt-${preset.id}`}>Deskripsi</Label>
                          <Textarea
                            id={`edit-acc-prompt-${preset.id}`}
                            value={editPromptFragment}
                            onChange={(e) => setEditPromptFragment(e.target.value)}
                            rows={2}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            loading={savingEdit}
                            disabled={!editName.trim() || !editPromptFragment.trim()}
                            onClick={() => saveEdit(preset)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Simpan
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" />
                            Batal
                          </Button>
                        </div>
                      </CardBody>
                    ) : (
                      <>
                        {preset.reference_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={preset.reference_image_url}
                            alt={preset.name}
                            className="h-24 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-24 w-full items-center justify-center bg-surface-2">
                            <ImageIcon className="h-6 w-6 text-text-faint" />
                          </div>
                        )}
                        <CardBody>
                          <Badge tone="gold" className="mb-2">
                            {ACCESSORY_CATEGORIES.find((c) => c.value === preset.category)?.label}
                          </Badge>
                          <div className="mb-1 font-medium text-text">{preset.name}</div>
                          <p className="mb-3 line-clamp-2 text-xs text-text-muted">
                            {preset.prompt_fragment}
                          </p>
                          <div className="mb-3">
                            <Badge tone={preset.is_active ? "success" : "muted"}>
                              {preset.is_active ? "Aktif" : "Nonaktif"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => toggleActive(preset)}>
                              {preset.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => startEdit(preset)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleDelete(preset)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardBody>
                      </>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
