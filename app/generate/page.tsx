"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImageIcon, Plus, Search, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, FieldHint } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  AccessoryCategory,
  AccessoryPresetRow,
  AiModel,
  AiPose,
  BackgroundMode,
  BackgroundPresetRow,
  Generation,
  GenerationSet,
} from "@/types/database";

// Generate — halaman utama (PRD §14, §7.6): pilih model/pose/background
// (mode Auto default)/aksesoris, upload produk, generate 1 set foto.
// Panggil POST /api/generate-set — request ini SINKRON dan bisa makan waktu
// beberapa menit (lihat catatan di app/api/generate-set/route.ts).
//
// REVISI setelah feedback pertama: pose & produk sekarang dipilih lewat
// grid gambar (bukan dropdown teks / ketik kode), dan jumlah foto detail
// bisa diatur (default 2 = total 3 foto) supaya biaya lebih murah.

type ProductRow = {
  kode: string;
  nama: string;
  warna: string[] | null;
  image: string | null;
};

type ProductImages = {
  front: string | null;
  back: string | null;
  detailNeck: string | null;
  detailSleeve: string | null;
  detailChest: string | null;
  detailHem: string | null;
  fullBody: string | null;
};

// "seri" = varian warna lain dari produk yang sama. REVISI hemat-foto
// (Agustus 2026): CUKUP satu foto full-body per warna — foto detail/
// konstruksi lainnya otomatis dipakai ulang dari foto warna utama di atas
// (bentuk/bordir/motif identik lintas warna, cuma warna kain yang beda).
// Lihat catatan lengkap di app/api/generate-set/route.ts REVISI #6.
type SeriEntry = {
  warna: string;
  image: string | null;
};

type GenerationSetResult = GenerationSet & { ai_generations: Generation[] };

const ACCESSORY_CATEGORY_LABELS: Record<AccessoryCategory, string> = {
  tas: "Tas",
  kalung: "Kalung",
  cincin: "Cincin",
  anting: "Anting",
};

const STEPS = [
  { n: 1, label: "Model & Pose" },
  { n: 2, label: "Produk" },
  { n: 3, label: "Foto Flat-Lay" },
  { n: 4, label: "Gaya" },
];

// Estimasi biaya (Rp) — cermin dari app/api/generate-set/route.ts.
// REVISI Agustus 2026: VTO pindah ke FASHN ($0.075/panggilan, lebih akurat
// utk motif/tekstur kain tapi lebih mahal dari FLUX VTO lama).
// REVISI Agustus 2026 ("Opsi B"): mesin utama pindah ke Nano Banana Pro
// (1 pemanggilan, $0.15/gambar @ resolusi 1K) — lihat lib/prompts/
// nano-banana-generate.ts & app/api/generate-set/route.ts.
const COST_UTAMA = 2700; // 1x Nano Banana Pro (sudah termasuk background)
const COST_ANGLE = 2700; // pose beda -> panggilan independen lagi, sama mahal spt utama
const COST_DERIVED = 640; // detail -> diturunkan dari utama, cuma 1x Kontext
// REVISI FINAL: "seri" sekarang generate PENUH pakai foto asli warna itu
// (bukan recolor tebakan AI) -> sama mahalnya dengan angle, BUKAN lagi 640.
const COST_SERI = COST_ANGLE;

export default function GeneratePage() {
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [poses, setPoses] = useState<AiPose[]>([]);
  const [selectedPoseId, setSelectedPoseId] = useState("");
  const [angleposeIds, setAnglePoseIds] = useState<string[]>([]);

  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);
  const [productWarna, setProductWarna] = useState("");
  // REVISI FINAL (Agustus 2026): "seri" = varian WARNA lain dari produk yang
  // sama, TIAP warna dgn foto flat-lay ASLI sendiri (bukan tebakan AI dari
  // recolor foto utama — itu sempat dicoba, akurasinya diragukan).
  const [seriEntries, setSeriEntries] = useState<SeriEntry[]>([]);

  const [productImages, setProductImages] = useState<ProductImages>({
    front: null,
    back: null,
    detailNeck: null,
    detailSleeve: null,
    detailChest: null,
    detailHem: null,
    fullBody: null,
  });

  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("auto");
  const [backgroundPresets, setBackgroundPresets] = useState<BackgroundPresetRow[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("");

  const [accessoryPresets, setAccessoryPresets] = useState<AccessoryPresetRow[]>([]);
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<string[]>([]);

  const [detailCount, setDetailCount] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<GenerationSetResult | null>(null);

  useEffect(() => {
    async function loadInitial() {
      const supabase = createClient();
      const [modelsRes, presetsRes, accessoriesRes] = await Promise.all([
        supabase.from("ai_models").select("*").eq("is_active", true).order("name"),
        supabase.from("ai_background_presets").select("*").eq("is_active", true).order("name"),
        supabase.from("ai_accessory_presets").select("*").eq("is_active", true).order("category"),
      ]);
      const modelRows = (modelsRes.data as AiModel[]) ?? [];
      setModels(modelRows);
      if (modelRows.length > 0) setSelectedModelId(modelRows[0].id);
      setBackgroundPresets((presetsRes.data as BackgroundPresetRow[]) ?? []);
      setAccessoryPresets((accessoriesRes.data as AccessoryPresetRow[]) ?? []);
    }
    loadInitial();
  }, []);

  useEffect(() => {
    async function loadPoses() {
      if (!selectedModelId) {
        setPoses([]);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("ai_poses")
        .select("*")
        .eq("model_id", selectedModelId)
        .eq("is_active", true)
        .order("name");
      const rows = (data as AiPose[]) ?? [];
      setPoses(rows);
      setSelectedPoseId(rows.length > 0 ? rows[0].id : "");
      setAnglePoseIds([]);
    }
    loadPoses();
  }, [selectedModelId]);

  // Browse katalog produk Deera langsung (bukan ketik kode dulu) — search
  // di bawah cuma buat mempersempit, bukan syarat.
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingProducts(true);
      const supabase = createClient();
      const base = supabase.from("products").select("kode,nama,warna,image");
      const { data } = productQuery.trim()
        ? await base
            .or(`kode.ilike.%${productQuery}%,nama.ilike.%${productQuery}%`)
            .order("kode")
            .limit(30)
        : await base.order("position", { ascending: true }).limit(30);
      setProductResults((data as ProductRow[]) ?? []);
      setLoadingProducts(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [productQuery]);

  function selectProduct(product: ProductRow) {
    setSelectedProduct(product);
    setProductWarna(product.warna?.[0] ?? "");
    setSeriEntries([]); // admin upload manual foto per warna yang mau digenerate sbg seri
  }

  function addSeriEntry(warna: string) {
    setSeriEntries((prev) => [...prev, { warna, image: null }]);
  }

  function removeSeriEntry(warna: string) {
    setSeriEntries((prev) => prev.filter((e) => e.warna !== warna));
  }

  function updateSeriEntryImage(warna: string, url: string | null) {
    setSeriEntries((prev) => prev.map((e) => (e.warna === warna ? { ...e, image: url } : e)));
  }

  function toggleAccessory(id: string) {
    setSelectedAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAnglePose(id: string) {
    setAnglePoseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  }

  const step1Done = !!selectedModelId && !!selectedPoseId;
  const step2Done = !!selectedProduct;
  const step3Done = !!productImages.front;
  const canSubmit = step1Done && step2Done && step3Done && !submitting;

  const validSeriEntries = seriEntries.filter((e) => e.image);
  const totalPhotos = 1 + angleposeIds.length + detailCount + validSeriEntries.length;
  const estimatedCost =
    COST_UTAMA +
    angleposeIds.length * COST_ANGLE +
    detailCount * COST_DERIVED +
    validSeriEntries.length * COST_SERI;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct || !productImages.front) return;
    setSubmitting(true);
    setResult(null);

    const toastId = toast.loading("Sedang generate set foto — proses ini bisa memakan beberapa menit...");

    try {
      const res = await fetch("/api/generate-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: selectedModelId,
          poseId: selectedPoseId,
          productKode: selectedProduct.kode,
          backgroundMode,
          backgroundPresetId: backgroundMode === "preset" ? selectedPresetId || undefined : undefined,
          accessoryPresetIds: selectedAccessoryIds,
          productImages: {
            front: productImages.front,
            back: productImages.back ?? undefined,
            detailNeck: productImages.detailNeck ?? undefined,
            detailSleeve: productImages.detailSleeve ?? undefined,
            detailChest: productImages.detailChest ?? undefined,
            detailHem: productImages.detailHem ?? undefined,
            fullBody: productImages.fullBody ?? undefined,
          },
          anglePoseIds: angleposeIds,
          productWarna: productWarna || undefined,
          seriEntries: validSeriEntries.map((e) => ({
            warna: e.warna,
            image: e.image,
          })),
          detailCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate gagal");
      }

      const detailRes = await fetch(`/api/generation-sets/${data.generationSetId}`);
      const detail = await detailRes.json();
      setResult(detail as GenerationSetResult);
      toast.success("Set foto selesai digenerate", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Studio"
        title="Generate Set Foto"
        description="Hasil Virtual Try-On dengan background & aksesoris sesuai gaya Deera. Jumlah foto per set bisa diatur di bawah."
      />

      {/* Stepper */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const done = [step1Done, step2Done, step3Done, true][i];
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                  done ? "border-gold bg-gold/10 text-gold" : "border-border-strong text-text-faint"
                )}
              >
                {s.n}
              </div>
              <span className={cn("text-sm", done ? "text-text" : "text-text-faint")}>{s.label}</span>
              {i < STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border-strong" />}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Model &amp; Pose</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {models.length === 0 ? (
              <p className="text-sm text-text-muted">
                Belum ada model aktif. Tambah dulu di halaman Models.
              </p>
            ) : (
              <>
                <div>
                  <Label htmlFor="gen-model">Model</Label>
                  <Select
                    id="gen-model"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Pose</Label>
                  {poses.length === 0 ? (
                    <p className="text-sm text-text-muted">
                      Model ini belum punya pose aktif. Tambah dulu di halaman Poses.
                    </p>
                  ) : (
                    <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-4">
                      {poses.map((pose) => {
                        const active = selectedPoseId === pose.id;
                        return (
                          <button
                            type="button"
                            key={pose.id}
                            onClick={() => {
                              setSelectedPoseId(pose.id);
                              setAnglePoseIds((prev) => prev.filter((id) => id !== pose.id));
                            }}
                            className={cn(
                              "group relative overflow-hidden rounded-md border-2 text-left transition-colors",
                              active ? "border-gold" : "border-transparent hover:border-border-strong"
                            )}
                          >
                            <div className="aspect-[3/4] w-full bg-surface-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={pose.reference_image_url}
                                alt={pose.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            {active && (
                              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                            <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] leading-tight text-white">
                              {pose.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {poses.length > 1 && (
                  <div>
                    <Label>
                      Foto angle lain (opsional — badan penuh dari pose berbeda, maks 3)
                    </Label>
                    <div className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-4">
                      {poses
                        .filter((p) => p.id !== selectedPoseId)
                        .map((pose) => {
                          const active = angleposeIds.includes(pose.id);
                          const disabled = !active && angleposeIds.length >= 3;
                          return (
                            <button
                              type="button"
                              key={pose.id}
                              onClick={() => toggleAnglePose(pose.id)}
                              disabled={disabled}
                              className={cn(
                                "group relative overflow-hidden rounded-md border-2 text-left transition-colors disabled:opacity-30",
                                active
                                  ? "border-gold-dark"
                                  : "border-transparent hover:border-border-strong"
                              )}
                            >
                              <div className="aspect-[3/4] w-full bg-surface-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={pose.reference_image_url}
                                  alt={pose.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              {active && (
                                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold-dark text-ink">
                                  <Check className="h-3 w-3" />
                                </span>
                              )}
                              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] leading-tight text-white">
                                {pose.name}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                    {angleposeIds.length > 0 && (
                      <FieldHint>
                        {angleposeIds.length} pose angle terpilih — tiap foto angle butuh proses
                        Virtual Try-On sendiri (±Rp1.400/foto).
                      </FieldHint>
                    )}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Produk</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div>
              <Label htmlFor="gen-product">Cari di katalog Deera (opsional)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
                <Input
                  id="gen-product"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Ketik buat filter, atau langsung pilih di bawah"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-4">
              {loadingProducts ? (
                <p className="col-span-full py-6 text-center text-sm text-text-faint">Memuat produk...</p>
              ) : productResults.length === 0 ? (
                <p className="col-span-full py-6 text-center text-sm text-text-faint">
                  Tidak ada produk yang cocok.
                </p>
              ) : (
                productResults.map((p) => {
                  const active = selectedProduct?.kode === p.kode;
                  return (
                    <button
                      type="button"
                      key={p.kode}
                      onClick={() => selectProduct(p)}
                      className={cn(
                        "group relative overflow-hidden rounded-md border-2 text-left transition-colors",
                        active ? "border-gold" : "border-transparent hover:border-border-strong"
                      )}
                    >
                      <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt={p.nama} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-text-faint" />
                        )}
                      </div>
                      {active && (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] leading-tight text-white">
                        {p.kode}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {selectedProduct && (
              <>
                <p className="text-sm text-text">
                  Dipilih: <span className="font-medium text-gold-dark">{selectedProduct.kode}</span> —{" "}
                  {selectedProduct.nama}
                </p>
                {selectedProduct.warna && selectedProduct.warna.length > 0 && (
                  <div>
                    <Label htmlFor="gen-warna">Warna utama (untuk kerudung &amp; heels)</Label>
                    <Select
                      id="gen-warna"
                      value={productWarna}
                      onChange={(e) => {
                        setProductWarna(e.target.value);
                        setSeriEntries((prev) => prev.filter((entry) => entry.warna !== e.target.value));
                      }}
                    >
                      {selectedProduct.warna.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
                {selectedProduct.warna && selectedProduct.warna.length > 1 && (
                  <div>
                    <Label>Foto seri — varian warna lain (opsional)</Label>
                    <p className="mb-2 text-xs text-text-faint">
                      Produk ini tersedia di beberapa warna. Foto Flat-Lay Produk di atas
                      HANYA untuk warna utama ({productWarna || "warna default"}). Untuk warna
                      lain, cukup upload SATU foto full body per warna — detail bordir/motif/
                      potongan otomatis dipakai ulang dari foto warna utama di atas (bentuknya
                      identik, cuma warna kainnya beda), jadi tidak perlu foto ulang lengkap.
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedProduct.warna
                        .filter((w) => w !== productWarna && !seriEntries.some((e) => e.warna === w))
                        .map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => addSeriEntry(w)}
                            className="flex items-center gap-1 rounded-full border border-border-strong bg-surface-2 px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-gold/50"
                          >
                            <Plus className="h-3 w-3" />
                            {w}
                          </button>
                        ))}
                    </div>

                    {seriEntries.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {seriEntries.map((entry) => (
                          <div
                            key={entry.warna}
                            className="rounded-lg border border-border-strong bg-surface-2 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-text">{entry.warna}</span>
                              <button
                                type="button"
                                onClick={() => removeSeriEntry(entry.warna)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-text-faint hover:bg-surface hover:text-danger"
                                title="Hapus warna ini"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <ImageUploadField
                              label={`Full Body — ${entry.warna}`}
                              folder="products"
                              value={entry.image}
                              onChange={(url) => updateSeriEntryImage(entry.warna, url)}
                              required
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {seriEntries.length > 0 && (
                      <FieldHint>
                        {validSeriEntries.length}/{seriEntries.length} warna siap (foto full
                        body terisi) · ~Rp{COST_SERI.toLocaleString("id-ID")}/warna
                      </FieldHint>
                    )}
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>3. Foto Flat-Lay Produk</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-4 text-sm text-text-muted">
              Foto raw produk apa adanya (belum diedit). Cuma &quot;Depan&quot; yang wajib, tapi
              SEMUA foto yang diisi ikut dikirim ke AI sebagai acuan (mesin generate sekarang
              bisa membaca banyak foto sekaligus) — makin lengkap foto detailnya, makin akurat
              motif/tekstur produk di hasil akhir.
            </p>
            <p className="mb-4 rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-xs text-text-muted">
              <span className="font-medium text-text">Tips supaya hasil AI lebih akurat:</span>{" "}
              tiap foto sebaiknya kain dibentangkan rata (bukan digantung), pencahayaan merata
              tanpa bayangan/kusut, dan background polos. Foto yang kusut/gelap bikin AI sulit
              menangkap tekstur bordir, motif detail, dan sheen kain secara presisi.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <ImageUploadField
                label="Depan"
                folder="products"
                value={productImages.front}
                onChange={(url) => setProductImages((p) => ({ ...p, front: url }))}
                required
              />
              <ImageUploadField
                label="Belakang"
                folder="products"
                value={productImages.back}
                onChange={(url) => setProductImages((p) => ({ ...p, back: url }))}
              />
              <ImageUploadField
                label="Detail Dada"
                folder="products"
                value={productImages.detailChest}
                onChange={(url) => setProductImages((p) => ({ ...p, detailChest: url }))}
              />
              <ImageUploadField
                label="Detail Leher"
                folder="products"
                value={productImages.detailNeck}
                onChange={(url) => setProductImages((p) => ({ ...p, detailNeck: url }))}
              />
              <ImageUploadField
                label="Detail Lengan"
                folder="products"
                value={productImages.detailSleeve}
                onChange={(url) => setProductImages((p) => ({ ...p, detailSleeve: url }))}
              />
              <ImageUploadField
                label="Detail Bagian Bawah"
                folder="products"
                value={productImages.detailHem}
                onChange={(url) => setProductImages((p) => ({ ...p, detailHem: url }))}
              />
              <ImageUploadField
                label="Full Body (Atas-Bawah)"
                folder="products"
                value={productImages.fullBody}
                onChange={(url) => setProductImages((p) => ({ ...p, fullBody: url }))}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Background</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "auto", label: "Auto", hint: "kombinasi preset & improvisasi" },
                  { value: "preset", label: "Pilih dari preset", hint: null },
                  { value: "ai_improvised", label: "Improvisasi AI penuh", hint: null },
                ] as { value: BackgroundMode; label: string; hint: string | null }[]
              ).map((mode) => (
                <label
                  key={mode.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors",
                    backgroundMode === mode.value
                      ? "border-gold/60 bg-gold/5 text-text"
                      : "border-border-strong text-text-muted hover:border-border-strong/80"
                  )}
                >
                  <input
                    type="radio"
                    name="backgroundMode"
                    checked={backgroundMode === mode.value}
                    onChange={() => setBackgroundMode(mode.value)}
                    className="h-4 w-4 accent-[#697e3e]"
                  />
                  <span>
                    {mode.label}
                    {mode.hint && <span className="ml-1.5 text-xs text-text-faint">({mode.hint})</span>}
                  </span>
                </label>
              ))}
            </div>
            {backgroundMode === "preset" &&
              (backgroundPresets.length === 0 ? (
                <p className="text-xs text-text-faint">
                  Belum ada preset background aktif — tambah di halaman Presets.
                </p>
              ) : (
                <Select value={selectedPresetId} onChange={(e) => setSelectedPresetId(e.target.value)}>
                  <option value="">— pilih preset —</option>
                  {backgroundPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Aksesoris (opsional)</CardTitle>
          </CardHeader>
          <CardBody>
            {accessoryPresets.length === 0 ? (
              <p className="text-sm text-text-muted">Belum ada preset aksesoris aktif.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accessoryPresets.map((a) => {
                  const active = selectedAccessoryIds.includes(a.id);
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => toggleAccessory(a.id)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                        active
                          ? "border-gold bg-gold/10 text-gold-soft"
                          : "border-border-strong text-text-muted hover:border-border-strong/80"
                      )}
                    >
                      <span className="text-text-faint">
                        [{ACCESSORY_CATEGORY_LABELS[a.category]}]
                      </span>{" "}
                      {a.name}
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>6. Jumlah Foto Close-Up</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="mb-3 text-sm text-text-muted">
              Foto utama selalu dibuat, dan foto angle (kalau dipilih di atas) selalu badan penuh.
              Yang bisa diatur di sini cuma foto close-up (zoom kerah/lengan/tekstur) yang
              diturunkan dari foto utama — makin sedikit, makin murah.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-muted">Foto close-up:</span>
              {[0, 1, 2, 3].map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => setDetailCount(n)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm transition-colors",
                    detailCount === n
                      ? "border-gold bg-gold text-ink"
                      : "border-border-strong text-text-muted hover:border-gold/60"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 px-4 py-3">
              <Badge tone="gold">{totalPhotos} foto total</Badge>
              <span className="text-sm text-text-muted">
                1 utama
                {angleposeIds.length > 0 && ` + ${angleposeIds.length} angle`}
                {detailCount > 0 && ` + ${detailCount} close-up`}
                {validSeriEntries.length > 0 && ` + ${validSeriEntries.length} seri warna`} · Estimasi biaya:{" "}
                <span className="font-medium text-text">
                  Rp {estimatedCost.toLocaleString("id-ID")}
                </span>
              </span>
            </div>
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" size="lg" loading={submitting} disabled={!canSubmit}>
            <Wand2 className="h-4 w-4" />
            {submitting ? "Sedang generate..." : `Generate ${totalPhotos} Foto`}
          </Button>
        </div>
      </form>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-gold" />
                  Hasil — {result.product_kode}
                </CardTitle>
                <Badge
                  tone={
                    result.status === "completed"
                      ? "success"
                      : result.status === "partial"
                        ? "gold"
                        : "muted"
                  }
                >
                  {result.status}
                </Badge>
              </CardHeader>
              <CardBody>
                <p className="mb-4 text-sm text-text-muted">
                  Total biaya estimasi: Rp {result.total_cost?.toLocaleString("id-ID") ?? "—"}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {result.ai_generations.map((gen) => (
                    <div
                      key={gen.id}
                      className="overflow-hidden rounded-lg border border-border bg-surface-2 text-center"
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
                      <div className="p-2">
                        <div className="text-xs font-medium capitalize text-text">{gen.image_role}</div>
                        <div className="text-xs text-text-faint">{gen.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
