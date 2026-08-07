// Mode background v0.5 (PRD §7.4, §7.6, §9): campuran preset terkurasi +
// improvisasi dinamis, TANPA panggilan LLM tambahan (murni templating server
// -side, hemat biaya & latensi). Ini "otak" di balik background_mode = 'auto'.

export type BackgroundMode = "auto" | "preset" | "ai_improvised";

export interface BackgroundPreset {
  id: string;
  name: string;
  prompt_fragment: string;
  mood_tags: string[];
  warna_affinity: string[];
  cocok_untuk_kategori: string[];
  last_used_at: string | null;
  use_count: number;
}

export interface ComposeBackgroundInput {
  mode: BackgroundMode;
  productWarna?: string;
  productKategori?: string;
  presets: BackgroundPreset[]; // hasil query background_presets yg is_active
  forcedPresetId?: string; // override manual dari admin
}

export interface ComposedBackground {
  source: "preset" | "ai_improvised";
  presetId?: string;
  description: string; // dipakai sbg {background_description} di prompt tahap 2 (§7.6)
}

// Elemen kombinasi untuk mode AI Improvisasi — daftar ini yang dimaksud PRD
// §7.4 "material, mood/pencahayaan, setting, warna aksen". Dikurasi sesuai
// estetika brand Deera (mewah, hangat, aksen olive #697E3E & gold pucat #F6DD8B) — lihat juga
// 15-20+ preset kurasi di tabel ai_background_presets (halaman Presets).
const MATERIALS = [
  "lantai marmer putih dengan urat emas",
  "dinding beludru dusty rose",
  "panel kayu jati ukir",
  "kaca patri warna pastel",
  "tirai satin mengkilap",
  "lantai terakota mediterania",
  "ubin geometris bermotif Maroko",
  "dinding plester warna krem hangat",
  "lantai kayu parket natural",
  "dinding batu bata ekspos yang dicat putih",
];

const MOODS = [
  "pencahayaan golden hour yang hangat",
  "cahaya lembut pagi hari menembus tirai",
  "pencahayaan dramatis ala butik malam hari",
  "cahaya alami menyebar lembut dari jendela besar",
  "cahaya senja keemasan dengan bayangan lembut",
  "pencahayaan studio soft-box yang bersih dan merata",
];

const SETTINGS = [
  "lounge butik mewah",
  "teras rumah bergaya mediterania",
  "taman dengan tanaman hijau rimbun",
  "kamar bertema pengantin klasik",
  "galeri seni minimalis",
  "courtyard riad bergaya Maroko",
  "rooftop kota saat senja",
  "kebun bunga pastel yang bermekaran",
  "cafe vintage bergaya Eropa",
  "halaman dengan pilar arsitektur megah",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Susun deskripsi background dari kombinasi elemen, diselaraskan warna produk.
function composeImprovised(productWarna?: string): string {
  const material = pickRandom(MATERIALS);
  const mood = pickRandom(MOODS);
  const setting = pickRandom(SETTINGS);
  const warnaClause = productWarna
    ? `, dengan aksen warna senada ${productWarna}`
    : "";
  return `${setting} dengan ${material}, ${mood}${warnaClause}`;
}

// Pilih preset terbaik: prioritaskan match warna/kategori, lalu hindari
// preset yang baru saja dipakai (rotasi, lihat background_presets.last_used_at).
function pickBestPreset(
  presets: BackgroundPreset[],
  productWarna?: string,
  productKategori?: string
): BackgroundPreset | null {
  if (presets.length === 0) return null;

  const scored = presets.map((p) => {
    let score = 0;
    if (productWarna && p.warna_affinity.includes(productWarna)) score += 2;
    if (productKategori && p.cocok_untuk_kategori.includes(productKategori))
      score += 2;
    // Penalti kalau baru saja dipakai — dorong rotasi
    if (p.last_used_at) {
      const hoursSinceUse =
        (Date.now() - new Date(p.last_used_at).getTime()) / 36e5;
      if (hoursSinceUse < 24) score -= 3;
    }
    return { preset: p, score };
  });

  scored.sort((a, b) => b.score - a.score || a.preset.use_count - b.preset.use_count);
  return scored[0].preset;
}

export function composeBackground(
  input: ComposeBackgroundInput
): ComposedBackground {
  if (input.forcedPresetId) {
    const forced = input.presets.find((p) => p.id === input.forcedPresetId);
    if (forced) {
      return { source: "preset", presetId: forced.id, description: forced.prompt_fragment };
    }
  }

  if (input.mode === "preset") {
    const preset = pickBestPreset(input.presets, input.productWarna, input.productKategori);
    if (preset) {
      return { source: "preset", presetId: preset.id, description: preset.prompt_fragment };
    }
    // fallback kalau library preset kosong
    return { source: "ai_improvised", description: composeImprovised(input.productWarna) };
  }

  if (input.mode === "ai_improvised") {
    return { source: "ai_improvised", description: composeImprovised(input.productWarna) };
  }

  // mode "auto" (default, PRD §7.4) — campur 60% preset / 40% improvisasi
  const usePreset = Math.random() < 0.6 && input.presets.length > 0;
  if (usePreset) {
    const preset = pickBestPreset(input.presets, input.productWarna, input.productKategori)!;
    return { source: "preset", presetId: preset.id, description: preset.prompt_fragment };
  }
  return { source: "ai_improvised", description: composeImprovised(input.productWarna) };
}
