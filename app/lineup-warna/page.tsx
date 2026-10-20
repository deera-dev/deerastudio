"use client";
// Halaman "Lineup Warna" — REVISI BESAR Agustus 2026, halaman baru sendiri
// (bukan lagi tombol nempel di panel detail History — admin: "bikin fitur
// baru kan saya bilang" setelah versi pertama dinilai bukan fitur baru
// sungguhan). Fitur ini sendiri sudah beberapa kali revisi besar sebelum
// sampai sini:
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
//  v3 — admin: "disini kan baru tersedia kalau seri warnanya sudah
//       terfoto/generate... saya gamau itu karena akan boros credit, harus
//       generate per seri foto satu2... saya bisa hanya attach foto asli
//       flat ray masing-masing warnanya". Sebelumnya, warna tambahan HARUS
//       berupa baris ai_generations role "seri" (History -> Tambah Warna
//       Seri), yang keberadaannya mewajibkan generate 1 foto model PENUH
//       per warna dulu (Rp2.700/warna). Sekarang halaman ini SEPENUHNYA
//       independen dari itu — warna tambahan dikelola sbg foto flat-lay
//       ASLI langsung di sini (ai_generation_sets.lineup_color_refs, lihat
//       app/api/generation-sets/[id]/lineup-color-refs/route.ts), TIDAK
//       PERNAH memicu generate AI apa pun sebelum "Generate Lineup Warna"
//       diklik (1x panggilan AI utk compose scene akhir).
//  v4 (Oktober 2026) — admin: picker ternyata masih cuma menampilkan
//       produk yang SUDAH punya baris ai_generation_sets (72% produk tidak
//       pernah diproses AI Fashion Studio sama sekali, jadi tidak pernah
//       muncul) + hard limit 40 baris ikut memotong sisanya. Picker
//       sekarang gabungan DUA sumber: baris ai_generation_sets yang sudah
//       ada (foto AI Studio) + SEMUA produk dari tabel `products` yang
//       belum punya baris sama sekali. Begitu admin tambah warna pertama
//       utk produk tipe kedua, baris "wadah" ai_generation_sets dibuat
//       otomatis di belakang layar (model_id/pose_id dikosongkan — fitur
//       ini tidak pernah butuh itu, lihat app/api/generation-sets/ensure/
//       route.ts) supaya lineup_color_refs tetap punya tempat nyimpan yang
//       sama seperti sebelumnya.
//  v5 (Oktober 2026) — admin sempat minta nama warna "foto utama" bisa
//       diisi (biar caption tidak selalu "Utama"), TAPI begitu dicoba:
//       "foto utama gausah ada harusnya, karena difoto ulang, jadinya
//       double ada warna [X]... cukup tidak usah dipakai aja foto
//       utamanya, di tampilan itu cukup file2 image baru yang diupload
//       aja". Konsep "foto utama" (set.product_images, foto katalog/AI
//       Studio lama) DIHAPUS SEPENUHNYA dari fitur ini — kadang kebetulan
//       sama persis dgn salah satu warna yang sudah di-upload ulang
//       terpisah sbg flat-lay, bikin 1 warna terkirim dobel ke AI.
//       lineup_color_refs (foto yang memang diupload lewat "+ Tambah
//       Warna" di halaman ini) sekarang SATU-SATUNYA sumber warna.
//
// Alur halaman ini: pilih produk -> upload foto flat-lay tiap warna (ganti
// foto yang buram/salah, tambah warna baru, hapus warna) -> pilih gaya
// (hanger/fanned) + catatan gaya opsional -> generate -> hasil satu foto
// "lineup" semua warna tersimpan sbg baris ai_generations role
// "kolase_warna" di set itu (idempotent, lihat app/api/generation-sets/
// [id]/color-lineup/route.ts).
import { useEffect, useState } from "react";
import { GripVertical, Info, Layers, Loader2, Plus, RefreshCw, Search, Shirt, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { showImageLightbox } from "@/components/ui/ImageLightbox";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Generation, GenerationSet } from "@/types/database";
import type { ColorLineupStyle } from "@/lib/prompts/color-lineup-generate";

type SetWithGenerations = GenerationSet & { ai_generations: Generation[] };

// Produk yang belum pernah diproses AI Fashion Studio sama sekali (belum
// punya baris ai_generation_sets) — ditampilkan LANGSUNG dari tabel
// `products` (lihat REVISI v4 di header atas), supaya tetap muncul di
// picker meski belum ada AI generation apa pun.
type ProductRow = { kode: string; nama: string; image: string | null; warna: string[] | null };

type PickerItem =
  | { key: string; kind: "set"; set: SetWithGenerations }
  | { key: string; kind: "virtual"; product: ProductRow };

// Satu entri warna = satu foto flat-lay yang diupload admin lewat
// "+ Tambah Warna" (lihat REVISI v5 di header — tidak ada lagi konsep
// "warna utama" yang beda perlakuan).
type ColorEntry = { warna: string; url: string; label: string };

// REVISI (Agustus 2026 — admin minta 2 gaya tambahan: "1nya adalah baju
// terlipat mirip seperti image-3 [referensi tumpukan sweater terlipat gaya
// etalase butik], tapi ga sama persis juga kaya gitu ya, 1nya lagi terserah
// ide kamu aja apalagi yang bagus" -> ditambahkan "folded" (diadaptasi jadi
// lebih premium/editorial, bukan reproduksi persis) & "flatlay" (top-down,
// pilihan sendiri — beda arah visual dari 3 gaya lain). Lihat penjelasan
// gaya lengkap di lib/prompts/color-lineup-generate.ts.
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
  {
    value: "folded",
    title: "Terlipat Rapi",
    desc: "Tiap warna dilipat jadi tumpukan rapi, disusun berjejer — gaya etalase butik.",
  },
  {
    value: "flatlay",
    title: "Flat Lay Atas",
    desc: "Semua warna dibentangkan rata, difoto dari atas, berjejer dengan jarak sama.",
  },
];

const MAX_TOTAL_COLORS = 7; // lihat batas di color-lineup/route.ts

function keyOf(entry: ColorEntry) {
  return entry.warna;
}

// Ambil daftar entri warna dari 1 set, URUT sesuai set.lineup_color_order
// (admin: "saya ingin bisa mengatur posisi warnanya") — dipakai baik utk
// preview referensi maupun dikirim ke API generate. Self-healing: key yang
// tidak ada di lineup_color_order (warna baru ditambah, atau urutan belum
// pernah diset, atau sisa "__main__" dari data lama) di-append/diabaikan
// SAMA dengan logic orderColorReferences() di server, supaya preview di
// sini selalu cocok dgn urutan yang benar-benar dipakai saat generate.
function collectColorEntries(set: SetWithGenerations): ColorEntry[] {
  const raw: ColorEntry[] = (set.lineup_color_refs ?? []).map((ref) => ({
    warna: ref.warna,
    url: ref.image,
    label: ref.warna,
  }));

  const byKey = new Map(raw.map((e) => [keyOf(e), e]));
  const order = set.lineup_color_order ?? [];
  const orderedKeys = order.filter((k) => byKey.has(k));
  const missingKeys = [...byKey.keys()].filter((k) => !orderedKeys.includes(k));
  return [...orderedKeys, ...missingKeys].map((k) => byKey.get(k)!);
}

export default function LineupWarnaPage() {
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<ColorLineupStyle>("hanger");
  const [styleNote, setStyleNote] = useState("");
  const [generating, setGenerating] = useState(false);
  // Form "+ Tambah Warna" — pilih dari products.warna produk ini (sama
  // spt dropdown "Tambah Warna Seri" di History), supaya nama warna
  // konsisten & tidak typo. Foto-nya WAJIB diupload manual (flat-lay ASLI).
  const [productWarnaOptions, setProductWarnaOptions] = useState<string[]>([]);
  const [newColorWarna, setNewColorWarna] = useState("");
  const [newColorImage, setNewColorImage] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState(false);

  // Picker gabungan DUA sumber (lihat REVISI v4 di header) — baris
  // ai_generation_sets yang sudah ada (foto AI Studio) + SEMUA produk dari
  // `products` yang belum punya baris sama sekali, supaya tidak ada produk
  // yang "hilang" hanya krn belum pernah diproses AI Fashion Studio.
  async function load(searchTerm: string) {
    setLoading(true);
    const supabase = createClient();
    const term = searchTerm.trim();

    let setQuery = supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .order("created_at", { ascending: false });
    if (term) setQuery = setQuery.ilike("product_kode", `%${term}%`);

    let productQuery = supabase.from("products").select("kode, nama, image, warna");
    productQuery = term
      ? productQuery.or(`kode.ilike.%${term}%,nama.ilike.%${term}%`).order("kode", { ascending: true })
      : productQuery.order("position", { ascending: true });

    const [{ data: setData }, { data: productData }] = await Promise.all([
      setQuery.limit(500),
      productQuery.limit(500),
    ]);

    const setRows = (setData as SetWithGenerations[]) ?? [];
    const coveredKodes = new Set(setRows.map((s) => s.product_kode));
    const virtualRows = ((productData as ProductRow[]) ?? []).filter((p) => !coveredKodes.has(p.kode));

    const nextItems: PickerItem[] = [
      ...setRows.map((set) => ({ key: `set:${set.id}`, kind: "set" as const, set })),
      ...virtualRows.map((product) => ({ key: `virtual:${product.kode}`, kind: "virtual" as const, product })),
    ];
    setItems(nextItems);
    setSelectedKey((prev) => (nextItems.some((i) => i.key === prev) ? prev : (nextItems[0]?.key ?? null)));
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    load(search);
  }, [search]);

  const selected = items.find((i) => i.key === selectedKey) ?? null;
  const selectedSet = selected?.kind === "set" ? selected.set : null;
  const selectedProduct = selected?.kind === "virtual" ? selected.product : null;
  const productKode = selectedSet?.product_kode ?? selectedProduct?.kode ?? null;

  const colorEntries = selectedSet ? collectColorEntries(selectedSet) : [];
  const lineupGen = selectedSet?.ai_generations.find((g) => g.image_role === "kolase_warna") ?? null;

  // Pilihan warna yang tersisa utk "+ Tambah Warna" — warna produk ini yang
  // belum ada di lineup_color_refs.
  useEffect(() => {
    setNewColorWarna("");
    setNewColorImage(null);
    if (!productKode) {
      setProductWarnaOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("products").select("warna").eq("kode", productKode).single();
      if (!cancelled) setProductWarnaOptions((data?.warna as string[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  const usedWarna = new Set(selectedSet?.lineup_color_refs.map((r) => r.warna) ?? []);
  const availableWarna = productWarnaOptions.filter((w) => !usedWarna.has(w));

  async function refreshOne(id: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("ai_generation_sets")
      .select("*, ai_generations(*)")
      .eq("id", id)
      .single();
    if (!data) return;
    const updated = data as SetWithGenerations;
    setItems((prev) => prev.map((i) => (i.kind === "set" && i.set.id === id ? { ...i, set: updated } : i)));
  }

  // Produk yang belum punya baris ai_generation_sets ("virtual") belum ada
  // tempat nyimpan warna — dipanggil sekali di awal aksi tulis pertama
  // (tambah warna / generate) utk membuat baris "wadah"-nya (lihat
  // app/api/generation-sets/ensure/route.ts), lalu produk itu "naik kelas"
  // jadi item kind:"set" spt yang lain.
  async function ensureSetId(): Promise<string | null> {
    if (selectedSet) return selectedSet.id;
    if (!selectedProduct) return null;
    try {
      const res = await fetch("/api/generation-sets/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKode: selectedProduct.kode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyiapkan data produk");
      const newId = data.id as string;

      const supabase = createClient();
      const { data: created } = await supabase
        .from("ai_generation_sets")
        .select("*, ai_generations(*)")
        .eq("id", newId)
        .single();
      if (created) {
        const newSet = created as SetWithGenerations;
        setItems((prev) => [
          { key: `set:${newSet.id}`, kind: "set" as const, set: newSet },
          ...prev.filter((i) => !(i.kind === "virtual" && i.product.kode === selectedProduct.kode)),
        ]);
        setSelectedKey(`set:${newSet.id}`);
      }
      return newId;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyiapkan data produk");
      return null;
    }
  }

  // REVISI (Agustus 2026 — admin lihat referensi warna framing-nya
  // tidak konsisten & salah satu SALAH: "kok gini sih, upload ulang aja,
  // mana salah pula mending kalau bener fotonya"): ganti foto referensi
  // LANGSUNG dari tile-nya. Tidak auto-regenerate lineup yang sudah ada —
  // admin klik "Buat Ulang Lineup" manual setelah foto baru ini siap.
  async function handleReplacePhoto(entry: ColorEntry, newUrl: string | null) {
    if (!newUrl) return;
    const setId = await ensureSetId();
    if (!setId) return;
    try {
      const updatedEntries = (selectedSet?.lineup_color_refs ?? []).map((r) =>
        r.warna === entry.warna ? { ...r, image: newUrl } : r
      );
      await saveColorRefs(setId, updatedEntries);
      toast.success(
        lineupGen
          ? "Foto referensi diperbarui — klik \"Buat Ulang Lineup\" supaya hasilnya ikut update"
          : "Foto referensi diperbarui"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan foto baru");
    } finally {
      await refreshOne(setId);
    }
  }

  async function saveColorRefs(setId: string, entries: { warna: string; image: string }[]) {
    const res = await fetch(`/api/generation-sets/${setId}/lineup-color-refs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Gagal menyimpan daftar warna");
  }

  // "+ Tambah Warna" — attach foto flat-lay ASLI langsung, TIDAK memicu
  // generate AI apa pun (beda dari "Tambah Warna Seri" di History).
  async function handleAddColor() {
    if (!newColorWarna || !newColorImage) return;
    setSavingColor(true);
    try {
      const setId = await ensureSetId();
      if (!setId) return;
      await saveColorRefs(setId, [...(selectedSet?.lineup_color_refs ?? []), { warna: newColorWarna, image: newColorImage }]);
      toast.success(`Warna ${newColorWarna} ditambahkan`);
      setNewColorWarna("");
      setNewColorImage(null);
      await refreshOne(setId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal tambah warna");
    } finally {
      setSavingColor(false);
    }
  }

  // REVISI (Agustus 2026 — admin ga sengaja klik trash & warnanya kehapus:
  // "tombol icon hapus harusnya ada konfirmasi dulu, saya ga sengaja jadi
  // hapus warna"): wajib konfirmasi dulu sebelum benar-benar menghapus.
  async function handleRemoveColor(warna: string) {
    if (!selectedSet) return;
    const ok = await confirmDialog({
      title: `Hapus warna ${warna} dari lineup?`,
      description:
        "Foto referensi warna ini akan dilepas dari lineup — kalau berubah pikiran, tambahkan lagi lewat \"+ Tambah Warna\".",
      confirmLabel: "Hapus",
      danger: true,
    });
    if (!ok) return;
    try {
      await saveColorRefs(selectedSet.id, (selectedSet.lineup_color_refs ?? []).filter((r) => r.warna !== warna));
      toast.success(`Warna ${warna} dihapus dari lineup`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal hapus warna");
    } finally {
      await refreshOne(selectedSet.id);
    }
  }

  // Admin: "saya ingin bisa mengatur posisi warnanya" -> "bisa ga drag and
  // drop aja dibanding pakai arrow?" — drag native HTML5 (draggable + drag
  // events), mulai dari handle kecil (GripVertical) di tiap tile, drop di
  // tile lain utk pindah ke posisi itu. Persist ke lineup_color_order sama
  // seperti sebelumnya, cuma cara memicunya yang berubah.
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  async function persistColorOrder(newOrder: string[]) {
    if (!selectedSet) return;
    try {
      const res = await fetch(`/api/generation-sets/${selectedSet.id}/lineup-color-order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan urutan warna");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan urutan warna");
    } finally {
      await refreshOne(selectedSet.id);
    }
  }

  function handleDropOnColor(targetEntry: ColorEntry) {
    const targetKey = keyOf(targetEntry);
    setDragOverKey(null);
    const fromKey = draggedKey;
    setDraggedKey(null);
    if (!fromKey || fromKey === targetKey) return;

    const currentOrder = colorEntries.map(keyOf);
    const fromIdx = currentOrder.indexOf(fromKey);
    const toIdx = currentOrder.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;

    const newOrder = [...currentOrder];
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, fromKey);
    void persistColorOrder(newOrder);
  }

  async function handleGenerate() {
    if (!selectedSet) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/generation-sets/${selectedSet.id}/color-lineup`, {
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
      await refreshOne(selectedSet.id);
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Katalog Warna"
        title="Lineup Warna"
        description="Gabungkan semua varian warna 1 produk jadi 1 foto premium (digantung atau berdiri fanned) lewat AI — cukup attach foto flat-lay asli tiap warna, tanpa perlu generate foto model per warna dulu."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Kolom kiri — picker produk (SEMUA produk, termasuk yang belum
            pernah diproses AI Fashion Studio — lihat REVISI v4 di header) */}
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
                placeholder="Cari kode/nama produk..."
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-text-faint">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-xs leading-relaxed text-text-faint">
                Tidak ada produk ditemukan.
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
                {items.map((item) => {
                  const thumb = item.kind === "set" ? (item.set.lineup_color_refs?.[0]?.image ?? null) : item.product.image;
                  const kode = item.kind === "set" ? item.set.product_kode : item.product.kode;
                  const colorCount = item.kind === "set" ? (item.set.lineup_color_refs?.length ?? 0) : 0;
                  const hasLineup = item.kind === "set" && item.set.ai_generations.some((g) => g.image_role === "kolase_warna");
                  const active = item.key === selectedKey;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setSelectedKey(item.key)}
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
                          <img src={thumb} alt={kode} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{kode}</p>
                        <p className="truncate text-xs text-text-faint">
                          {colorCount > 0 ? `${colorCount} warna` : "Belum ada warna"}
                        </p>
                      </div>
                      {hasLineup && <Badge tone="success">Sudah ada</Badge>}
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
                  Referensi Warna — {productKode}
                </CardTitle>
              </CardHeader>
              <CardBody>
                <p className="mb-3 text-xs text-text-faint">
                  {colorEntries.length} warna akan dikirim sbg referensi ke AI, URUT kiri ke kanan
                  sesuai posisi di bawah ini — geser pakai panah utk atur urutannya. Desain & warna
                  tiap produk WAJIB tetap persis sama dengan foto ini, AI cuma menyusun ulang
                  presentasinya. Foto buram/salah? Tarik foto baru langsung ke kotaknya utk mengganti.
                </p>

                <div className="flex flex-wrap gap-4">
                  {colorEntries.map((entry, i) => {
                    const key = keyOf(entry);
                    return (
                      <div
                        key={`${key}-${i}`}
                        onDragOver={(e) => {
                          if (!draggedKey || draggedKey === key) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverKey(key);
                        }}
                        onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDropOnColor(entry);
                        }}
                        className={cn(
                          "w-28 rounded-lg transition-shadow",
                          dragOverKey === key && draggedKey && draggedKey !== key && "ring-2 ring-gold/60"
                        )}
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            setDraggedKey(key);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggedKey(null);
                            setDragOverKey(null);
                          }}
                          title="Tarik utk atur urutan"
                          className="mb-1 flex cursor-grab items-center justify-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] py-1 text-text-faint active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-semibold uppercase tracking-wide">
                            {i + 1}
                          </span>
                        </div>
                        <ImageUploadField
                          label={entry.label}
                          folder="products"
                          value={entry.url}
                          onChange={(url) => handleReplacePhoto(entry, url)}
                          allowClear={false}
                        />
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => showImageLightbox(entry.url, entry.label)}
                            className="text-[11px] text-text-faint underline decoration-dotted hover:text-gold-soft"
                          >
                            Lihat penuh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveColor(entry.warna)}
                            className="text-text-faint hover:text-danger"
                            title="Hapus warna ini dari lineup"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* "+ Tambah Warna" — attach foto flat-lay ASLI langsung,
                    TIDAK memicu generate AI (beda dari "Tambah Warna Seri"
                    di History). */}
                {availableWarna.length > 0 && colorEntries.length < MAX_TOTAL_COLORS && (
                  <div className="mt-5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                    <p className="mb-2 text-xs font-medium text-text">+ Tambah Warna</p>
                    <p className="mb-3 text-xs text-text-faint">
                      Upload foto flat-lay asli warna ini — tidak perlu generate foto model dulu.
                    </p>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-40">
                        <Label htmlFor="new-color-warna">Warna</Label>
                        <Select
                          id="new-color-warna"
                          value={newColorWarna}
                          onChange={(e) => setNewColorWarna(e.target.value)}
                        >
                          <option value="">Pilih warna...</option>
                          {availableWarna.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="w-28">
                        <ImageUploadField
                          label="Flat-lay"
                          folder="products"
                          value={newColorImage}
                          onChange={setNewColorImage}
                          required
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        loading={savingColor}
                        disabled={!newColorWarna || !newColorImage}
                        onClick={handleAddColor}
                      >
                        <Plus className="h-4 w-4" />
                        Tambah
                      </Button>
                    </div>
                  </div>
                )}
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

                <Button onClick={handleGenerate} disabled={generating || colorEntries.length < 2 || !selectedSet}>
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
                  <FieldHint>Tambah minimal 2 warna dulu di atas sebelum generate.</FieldHint>
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
                  <div className="space-y-2">
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
                    <div className="mx-auto flex max-w-md items-start gap-1.5 text-xs text-text-faint">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <p>
                        Disclaimer: Warna pada gambar ini bisa terlihat sedikit berbeda dari warna asli produk
                      </p>
                    </div>
                  </div>
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
