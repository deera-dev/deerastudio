"use client";
// Halaman "Lineup Warna" — REVISI BESAR Agustus 2026, halaman baru sendiri
// (bukan lagi tombol nempel di panel detail History — admin: "bikin fitur
// baru kan saya bilang" setelah versi pertama dinilai bukan fitur baru
// sungguhan). Fitur ini sendiri sudah 2x revisi besar sebelum sampai sini:
//  v1 — admin: "tambahin 1 lagi ya untuk serian warna, saya mau masukin
//       jadi 1 foto aja digantung dengan hanger tanpa merubah detail
//       sedikit pun ... tambahin fitur ini di history ya" -> compositing
//       murni (next/og) dari foto ASLI, ditolak ("bukan gitu TOLOL") krn
//       hasilnya cuma grid foto flat-lay, bukan "digantung dengan hanger".
//  v2 — dipindah ke halaman sendiri per feedback "bikin fitur baru", TAPI
//       sebelum sempat dikirim balik, admin kirim 3 referensi foto
//       "colorway lineup" editorial (garment digantung rapi di hanger rail
//       / fanned overlapping, styling studio premium) + "bikin kaya
//       photoshot video seri warna, tapi versi yang lebih bagusnya" ->
//       jelas compositing mentah TIDAK bisa capai look itu, PIVOT ke AI
//       generation (Nano Banana Pro, lihat lib/prompts/
//       color-lineup-generate.ts). Fidelity warna & produk (permintaan
//       admin selanjutnya: "fokusnya ke warna harus sama persis, produknya
//       tentu ga boleh berubah") dijaga lewat prompt "blueprint/absolute
//       source of truth" + klausa COLOR ACCURACY eksplisit, BUKAN lagi
//       lewat ketiadaan AI.
//
// Alur halaman ini: pilih SET (produk) yang sudah punya >=1 warna seri ->
// lihat foto referensi tiap warna (bisa DIGANTI langsung di sini kalau ada
// yang buram/salah — lihat handleReplacePhoto & app/api/generation-sets/
// [id]/color-reference/route.ts) -> pilih gaya (hanger/fanned) + catatan
// gaya opsional -> generate -> hasil satu foto "lineup" semua warna
// tersimpan sbg baris ai_generations role "kolase_warna" di set itu
// (idempotent, lihat app/api/generation-sets/[id]/color-lineup/route.ts).
import { useEffect, useMemo, useState } from "react";
import { Layers, Loader2, RefreshCw, Search, Shirt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Textarea, FieldHint } from "@/components/ui/Field";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { showImageLightbox } from "@/components/ui/ImageLightbox";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Generation, GenerationSet } from "@/types/database";
import type { ColorLineupStyle } from "@/lib/prompts/color-lineup-generate";

type SetWithGenerations = GenerationSet & { ai_generations: Generation[] };

// REVISI (Agustus 2026 — admin lihat referensi warna 1 produk yang
// framing-nya tidak konsisten & salah satu foto SALAH: "kok gini sih,
// upload ulang aja, mana salah pula mending kalau bener fotonya"):
// tiap entri sekarang bawa `kind`/`generationId` supaya bisa DITIMPA foto
// barunya langsung dari sini lewat PATCH /api/generation-sets/[id]/
// color-reference, tanpa perlu bongkar-pasang lewat History.
type ColorEntry =
  | { kind: "main"; url: string; label: string }
  | { kind: "seri"; generationId: string; url: string; label: string };

const STYLE_OPTIONS: { value: ColorLineupStyle; title: string; desc: string }[] = [
  {
    value: "hanger",
    title: "Gantungan (Hanger Rail)",
    desc: "Semua warna digantung rapi berjejer di 1 rail, tampak depan penuh.",
  },
  {
    value: "fanned",
    title: "Berdiri Fanned",
    desc: "Semua warna berdiri saling tumpang tindih ringan membentuk kipas.",
  },
];

// Ambil daftar entri warna (utama + seri) dari 1 set — dipakai baik utk
// preview referensi maupun dikirim ke API generate.
function collectColorEntries(set: SetWithGenerations): ColorEntry[] {
  const mainUrl = set.product_images.fullBody ?? set.product_images.front;
  const seriRows = set.ai_generations
    .filter((g) => g.image_role === "seri")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const entries: ColorEntry[] = [];
  if (mainUrl) entries.push({ kind: "main", url: mainUrl, label: set.product_warna || "Utama" });
  for (const row of seriRows) {
    const url = (row.variant_product_images as Record<string, string> | null)?.image;
    if (url) entries.push({ kind: "seri", generationId: row.id, url, label: row.variant_warna || "Warna" });
  }
  return entries;
}

export default function LineupWarnaPage() {
  const [sets, setSets] = useState<SetWithGenerations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<ColorLineupStyle>("hanger");
  const [styleNote, setStyleNote] = useState("");
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    // Ambil set-set terbaru secukupnya lalu filter client-side utk yang
    // punya >=1 warna seri — daftar "qualifying" ini realistis tidak akan
    // sebesar riwayat penuh (History), jadi tidak butuh pagination
    // server-side spt History.
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .order("created_at", { ascending: false })
      .limit(300);
    const rows = ((data as SetWithGenerations[]) ?? []).filter(
      (s) => s.ai_generations.some((g) => g.image_role === "seri") &&
        (s.product_images.fullBody ?? s.product_images.front)
    );
    setSets(rows);
    setSelectedId((prev) => (rows.some((r) => r.id === prev) ? prev : (rows[0]?.id ?? null)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredSets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sets;
    return sets.filter((s) => s.product_kode.toLowerCase().includes(term));
  }, [sets, search]);

  useEffect(() => {
    // Kalau set yang sedang dipilih tidak lagi ada di hasil search, pindah
    // ke item pertama hasil search (kalau ada).
    if (!filteredSets.some((s) => s.id === selectedId)) {
      setSelectedId(filteredSets[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSets]);

  const selected = sets.find((s) => s.id === selectedId) ?? null;
  const colorEntries = selected ? collectColorEntries(selected) : [];
  const lineupGen = selected?.ai_generations.find((g) => g.image_role === "kolase_warna") ?? null;

  async function refreshOne(id: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .eq("id", id)
      .single();
    if (data) setSets((prev) => prev.map((s) => (s.id === id ? (data as SetWithGenerations) : s)));
  }

  // REVISI (Agustus 2026 — admin lihat referensi warna framing-nya
  // tidak konsisten & salah satu SALAH: "kok gini sih, upload ulang aja,
  // mana salah pula mending kalau bener fotonya"): ganti foto referensi
  // LANGSUNG dari tile-nya, tanpa balik ke History. Tidak auto-regenerate
  // lineup yang sudah ada — admin klik "Buat Ulang Lineup" manual stelah
  // foto baru ini siap dipakai.
  async function handleReplacePhoto(entry: ColorEntry, newUrl: string | null) {
    if (!selected || !newUrl) return;
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/color-reference`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          entry.kind === "main"
            ? { kind: "main", imageUrl: newUrl }
            : { kind: "seri", generationId: entry.generationId, imageUrl: newUrl }
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan foto baru");
      toast.success(
        lineupGen
          ? "Foto referensi diperbarui — klik \"Buat Ulang Lineup\" supaya hasilnya ikut update"
          : "Foto referensi diperbarui"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan foto baru");
    } finally {
      await refreshOne(selected.id);
    }
  }

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/generation-sets/${selected.id}/color-lineup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, styleNote: styleNote.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal membuat lineup warna");
      toast.success(lineupGen ? "Lineup warna diperbarui" : "Lineup warna berhasil dibuat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat lineup warna");
    } finally {
      await refreshOne(selected.id);
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Katalog Warna"
        title="Lineup Warna"
        description="Gabungkan semua varian warna 1 produk jadi 1 foto premium (digantung atau berdiri fanned) lewat AI — warna & desain produk dijaga persis sama dengan foto aslinya, cuma presentasi scene-nya yang dipercantik."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Kolom kiri — picker produk yang qualifying (punya >=1 warna seri) */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shirt className="h-4 w-4 text-gold" />
              Pilih Produk
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari kode produk..."
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-text-faint">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredSets.length === 0 ? (
              <p className="py-8 text-center text-xs leading-relaxed text-text-faint">
                Belum ada produk dengan warna seri. Tambah warna seri dulu lewat halaman{" "}
                <span className="text-text-muted">History</span> sebelum bisa bikin lineup warna.
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
                {filteredSets.map((s) => {
                  const thumb = s.product_images.fullBody ?? s.product_images.front;
                  const seriCount = s.ai_generations.filter((g) => g.image_role === "seri").length;
                  const active = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors",
                        active
                          ? "border-gold/40 bg-gold/[0.08]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                        {thumb && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt={s.product_kode} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{s.product_kode}</p>
                        <p className="truncate text-xs text-text-faint">
                          {s.product_warna || "Utama"} + {seriCount} warna seri
                        </p>
                      </div>
                      {s.ai_generations.some((g) => g.image_role === "kolase_warna") && (
                        <Badge tone="success">Sudah ada</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Kolom kanan — referensi warna + kontrol gaya + hasil */}
        {!selected ? (
          <Card>
            <CardBody className="py-16 text-center text-sm text-text-faint">
              Pilih produk di sebelah kiri utk mulai.
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="h-4 w-4 text-gold" />
                  Referensi Warna — {selected.product_kode}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <p className="mb-3 text-xs text-text-faint">
                  {colorEntries.length} warna akan dikirim sbg referensi ke AI — desain & warna tiap
                  produk WAJIB tetap persis sama dengan foto ini, AI cuma menyusun ulang presentasinya.
                  Foto buram/salah? Tarik foto baru langsung ke kotaknya utk mengganti.
                </p>
                <div className="flex flex-wrap gap-4">
                  {colorEntries.map((entry, i) => {
                    const key = entry.kind === "main" ? "main" : entry.generationId;
                    return (
                      <div key={`${key}-${i}`} className="w-28">
                        <ImageUploadField
                          label={entry.label}
                          folder="products"
                          value={entry.url}
                          onChange={(url) => handleReplacePhoto(entry, url)}
                          allowClear={false}
                        />
                        <button
                          type="button"
                          onClick={() => showImageLightbox(entry.url, entry.label)}
                          className="mt-1 text-[11px] text-text-faint underline decoration-dotted hover:text-gold-soft"
                        >
                          Lihat ukuran penuh
                        </button>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Gaya Penyajian</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStyle(opt.value)}
                      className={cn(
                        "rounded-xl border px-4 py-3 text-left transition-colors",
                        style === opt.value
                          ? "border-gold/50 bg-gold/[0.08]"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]"
                      )}
                    >
                      <p className="text-sm font-medium text-text">{opt.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-text-faint">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                <div>
                  <Label htmlFor="styleNote">Catatan gaya (opsional)</Label>
                  <Textarea
                    id="styleNote"
                    rows={2}
                    value={styleNote}
                    onChange={(e) => setStyleNote(e.target.value)}
                    placeholder="mis. backdrop lebih terang, tambah tanaman kecil di kanan..."
                  />
                  <FieldHint>Bahasa Inggris lebih akurat dipahami AI, tapi Indonesia juga bisa.</FieldHint>
                </div>

                <Button onClick={handleGenerate} disabled={generating || colorEntries.length < 2}>
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Membuat lineup...
                    </>
                  ) : lineupGen ? (
                    <>
                      <RefreshCw className="h-4 w-4" /> Buat Ulang Lineup
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Generate Lineup Warna
                    </>
                  )}
                </Button>
                {colorEntries.length < 2 && (
                  <FieldHint>Produk ini belum punya warna seri — tambah dulu lewat History.</FieldHint>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hasil</CardTitle>
              </CardHeader>
              <CardBody>
                {generating ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-faint">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p className="text-xs">AI sedang menyusun scene — biasanya 30-60 detik...</p>
                  </div>
                ) : lineupGen?.output_image_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      showImageLightbox(lineupGen.output_image_url as string, "Lineup Warna")
                    }
                    className="relative mx-auto block w-full max-w-md overflow-hidden rounded-xl border border-white/[0.08]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lineupGen.output_image_url}
                      alt="Lineup warna"
                      className="w-full object-cover"
                    />
                  </button>
                ) : (
                  <p className="py-16 text-center text-sm text-text-faint">
                    Belum ada hasil — klik &quot;Generate Lineup Warna&quot; di atas.
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
