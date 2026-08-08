// Content Studio (Agustus 2026) — generate caption + hashtag Instagram utk
// foto produk yang sudah ada di katalog Deera (products.image/detail/
// warna_images), pakai text-gen fal.ai (lib/fal/text.ts). TIDAK generate
// gambar sama sekali di sini — foto diambil apa adanya dari data produk.
//
// PRINSIP ANTI-HALUSINASI (penting): prompt HANYA boleh pakai fakta produk
// yang benar-benar dikirim (nama, bahan, warna, harga, ukuran) + catatan
// admin (extraNotes, mis. info promo/diskon nyata). LLM diinstruksikan
// eksplisit utk TIDAK mengarang testimoni, diskon, angka stok, atau klaim
// apa pun yang tidak ada di input.
import { generateText } from "../fal/text";

export type ContentTheme = "produk_highlight" | "tips_styling" | "brand_story" | "promo";
export type ContentType = "feed_single" | "carousel" | "reel";

export const THEME_LABELS: Record<ContentTheme, string> = {
  produk_highlight: "Highlight Produk",
  tips_styling: "Tips & Styling",
  brand_story: "Balik Layar / Brand",
  promo: "Promo / CTA",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  feed_single: "Feed — 1 Foto",
  carousel: "Feed — Carousel",
  reel: "Reel (butuh video)",
};

const THEME_GUIDANCE: Record<ContentTheme, string> = {
  produk_highlight:
    "Fokus perkenalkan produk ini secara menarik — ceritakan bahan, warna, dan kesan/kelebihan desainnya. Ajak audiens DM/chat WhatsApp untuk order, TANPA menyebut angka diskon atau promo apa pun kecuali disebutkan eksplisit di catatan tambahan.",
  tips_styling: "Fokus tips styling/mix-and-match umum memakai produk ini untuk berbagai acara (kondangan, kerja, harian, dsb). Boleh sedikit edukatif soal modest fashion secara umum. Jangan buat klaim spesifik soal produk yang tidak ada di data.",
  brand_story:
    "Fokus nilai brand & proses pembuatan secara umum (ketelitian jahitan, pemilihan bahan, semangat brand modest fashion Indonesia) — nada hangat, personal, TANPA mengarang sejarah/statistik/jumlah pelanggan yang tidak diberikan.",
  promo:
    "Fokus ajakan bertindak (CTA) yang jelas. HANYA sebutkan detail promo/diskon/periode kalau itu ADA di catatan tambahan di bawah — kalau catatan tambahan kosong, buat CTA generik (\"cek koleksi terbaru\", \"stok terbatas, buruan chat kami\") TANPA mengarang angka diskon atau tanggal apa pun.",
};

export interface CaptionProductContext {
  kode: string;
  nama: string;
  bahan?: string | null;
  warna?: string[] | null;
  hargaMin?: number | null;
  hargaMax?: number | null;
  ukuran?: string[] | null;
}

export interface GenerateCaptionInput {
  product: CaptionProductContext;
  theme: ContentTheme;
  contentType: ContentType;
  extraNotes?: string;
}

export interface GenerateCaptionResult {
  caption: string;
  hashtags: string[];
}

const SYSTEM_PROMPT = [
  "Kamu adalah social media specialist top-tier untuk Deera Indonesia, brand fashion muslim (gamis & mukena) asal Indonesia.",
  "Gaya bahasa: Bahasa Indonesia, hangat, elegan, sedikit puitis tapi tetap mudah dibaca — sopan dan sesuai nilai brand modest fashion. Hindari bahasa yang terlalu formal/kaku atau terlalu gaul/alay.",
  "PENDEKATAN (PENTING): tulis caption bergaya STORYTELLING/naratif, BUKAN copy jualan yang berbunyi seperti brosur. Buka dengan sepenggal momen, suasana, atau perasaan yang relatable (mis. pagi yang tenang sebelum acara keluarga, rasa percaya diri saat melangkah keluar rumah, ketenangan saat mengenakan sesuatu yang nyaman) — biarkan produk hadir SEBAGAI BAGIAN dari cerita itu, bukan jadi subjek utama yang dijual keras. Hindari kalimat generik ala iklan seperti 'cocok untuk kamu yang...', 'yuk buruan order', 'dapatkan sekarang juga', atau daftar fitur produk yang terasa seperti spesifikasi. Boleh pakai emoji secukupnya, jangan berlebihan.",
  "Closing tetap boleh mengarahkan audiens untuk DM/chat WhatsApp kalau tertarik, tapi sampaikan dengan lembut dan menyatu dengan nada cerita — bukan CTA keras/mendesak bergaya sales.",
  "ATURAN ANTI-HALUSINASI (WAJIB DIPATUHI): HANYA gunakan fakta produk yang diberikan di bawah (nama, bahan, warna, harga, ukuran) dan catatan tambahan dari admin. JANGAN PERNAH mengarang testimoni pelanggan, jumlah stok, tanggal promo, persentase diskon, statistik, atau klaim apa pun yang tidak eksplisit ada di input. Kalau informasi tertentu tidak diberikan, jangan sebutkan sama sekali daripada menebak.",
  "Caption harus PANJANG WAJAR untuk Instagram (sekitar 3-6 kalimat / 40-90 kata), bukan esai panjang.",
].join("\n");

function buildUserPrompt(input: GenerateCaptionInput): string {
  const { product, theme, contentType, extraNotes } = input;
  const hargaLine =
    product.hargaMin != null
      ? product.hargaMax != null && product.hargaMax !== product.hargaMin
        ? `Rp${product.hargaMin.toLocaleString("id-ID")} - Rp${product.hargaMax.toLocaleString("id-ID")}`
        : `Rp${product.hargaMin.toLocaleString("id-ID")}`
      : null;

  return [
    `DATA PRODUK (fakta, jangan tambah-tambahi):`,
    `- Kode: ${product.kode}`,
    `- Nama: ${product.nama}`,
    product.bahan ? `- Bahan: ${product.bahan}` : null,
    product.warna?.length ? `- Warna tersedia: ${product.warna.join(", ")}` : null,
    product.ukuran?.length ? `- Ukuran tersedia: ${product.ukuran.join(", ")}` : null,
    hargaLine ? `- Harga: ${hargaLine}` : null,
    "",
    `TEMA POSTINGAN: ${THEME_LABELS[theme]}`,
    THEME_GUIDANCE[theme],
    "",
    `FORMAT KONTEN: ${CONTENT_TYPE_LABELS[contentType]}${contentType === "carousel" ? " — caption boleh mengarahkan audiens geser slide (\"swipe untuk lihat detailnya\")." : ""}`,
    extraNotes?.trim() ? `\nCATATAN TAMBAHAN DARI ADMIN (boleh dipakai sbg fakta):\n${extraNotes.trim()}` : "",
    "",
    "Balas HANYA dalam format persis berikut, tanpa penjelasan lain di luar format ini:",
    "CAPTION:",
    "<isi caption di sini>",
    "HASHTAGS: #tag1 #tag2 #tag3 ...",
    "",
    "Hashtag: 8-12 hashtag relevan (campuran hashtag brand/produk spesifik dan hashtag fashion muslim/gamis yang lebih umum di Indonesia), dipisah spasi, semua diawali #.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function parseCaptionOutput(raw: string): GenerateCaptionResult {
  const hashtagsMatch = raw.match(/HASHTAGS:\s*([\s\S]*)$/i);
  const hashtagsLine = hashtagsMatch?.[1]?.trim() ?? "";
  const hashtags = Array.from(hashtagsLine.matchAll(/#[\p{L}\p{N}_]+/gu)).map((m) => m[0]);

  let caption = raw;
  if (hashtagsMatch) caption = raw.slice(0, hashtagsMatch.index).trim();
  caption = caption.replace(/^CAPTION:\s*/i, "").trim();

  return { caption, hashtags };
}

export async function generateCaption(
  input: GenerateCaptionInput
): Promise<GenerateCaptionResult> {
  const result = await generateText({
    prompt: buildUserPrompt(input),
    systemPrompt: SYSTEM_PROMPT,
    temperature: 1,
    maxTokens: 600,
  });

  return parseCaptionOutput(result.output);
}

// --- Poster AI ("social media specialist" sarankan headline poster) ---
// Beda dari generateCaption di atas: ini menyarankan COPY PENDEK untuk
// dirender di ATAS foto (headline besar, subtitle, caption bar bawah),
// dipakai lib/image-template/poster.tsx. Ini copywriting mood/tema (bukan
// klaim fakta produk spesifik) — tetap tunduk aturan anti-halusinasi utk
// bahan/harga/diskon/testimoni, tapi bebas berimprovisasi nada emosional.
// Kode produk & warna yang tersedia TIDAK diminta dari AI — itu diisi
// langsung dari data produk asli di route handler (lihat
// app/api/content/suggest-headline/route.ts), supaya tetap 100% akurat.

export interface SuggestHeadlineInput {
  product: CaptionProductContext;
  theme: ContentTheme;
  extraNotes?: string;
}

export interface SuggestHeadlineLine {
  text: string;
  script?: boolean;
}

export interface SuggestHeadlineResult {
  headline: SuggestHeadlineLine[];
  subtitle?: string;
  bottomCaption?: string;
  // Arahan scene/suasana (Bahasa Inggris, singkat) utk fitur "Foto Marketing
  // AI" — dipakai lib/prompts/marketing-photo.ts merestyle background foto
  // produk yang sudah ada (model+baju tetap 100% sama). Beda dari headline/
  // subtitle/bottomCaption di atas yang cuma teks overlay; ini benar-benar
  // dipakai sbg prompt image-gen kalau admin klik "Generate Foto Marketing".
  sceneIdea?: string;
}

const HEADLINE_SYSTEM_PROMPT = [
  "Kamu adalah social media specialist top-tier untuk Deera Indonesia, brand fashion muslim (gamis & mukena) asal Indonesia.",
  "Tugasmu SEKARANG: menyarankan HEADLINE pendek untuk poster/gambar Instagram yang dirender di atas foto produk — gaya majalah fashion premium, singkat, puitis, hangat, elegan. Ini BUKAN caption panjang.",
  "Ini adalah copywriting KREATIF bertema/mood, bukan copy jualan. Tulis seolah judul editorial majalah fashion — evokasi CERITA, momen, atau perasaan, BUKAN kalimat promosi. Contoh nada yang BENAR: \"Untuk Momen Berkumpul yang Hangat\", \"Anggun di Setiap Langkah\", \"Kelembutan yang Berbicara Sendiri\". Contoh nada yang SALAH/terlalu jualan (hindari): \"Koleksi Terbaru, Buruan Order!\", \"Gamis Nyaman untuk Sehari-hari\", \"Tampil Cantik dengan Deera\" — ini terdengar seperti iklan, bukan cerita.",
  "TAPI tetap jangan membuat klaim faktual spesifik (bahan/harga/diskon/stok) yang tidak ada di data produk.",
  "Balas HANYA dalam format JSON PERSIS berikut, tanpa teks/markdown lain di luar JSON:",
  '{"headline":[{"text":"...","script":false},{"text":"...","script":false}],"subtitle":"...","bottomCaption":"...","sceneIdea":"..."}',
  "Aturan \"headline\": array 1-3 objek. Maksimal 2 baris dengan \"script\":false (font serif besar) — tiap baris ringkas, idealnya 2-5 kata. Boleh tambahkan SATU baris opsional dengan \"script\":true berisi 1-3 kata aksen bergaya tulisan tangan elegan (mis. nama koleksi/kata puitis pendek) — kalau tidak pas, jangan dipaksakan, cukup 2 baris script:false saja.",
  "Aturan \"subtitle\": SATU baris pendek opsional (maksimal ~40 karakter), mis. nama varian/koleksi produk atau tagline pendek. Isi string kosong \"\" kalau tidak ada info koleksi yang relevan.",
  "Aturan \"bottomCaption\": SATU kalimat pendek opsional (maksimal ~90 karakter) untuk bar teks di bagian bawah poster, mis. deskripsi manfaat/kenyamanan produk secara UMUM (bukan klaim spesifik). Isi string kosong \"\" kalau tidak perlu.",
  "Aturan \"sceneIdea\": SATU arahan CERITA/MOMEN singkat dalam BAHASA INGGRIS sederhana (dipakai AI image-generator lain utk merestyle sebuah foto produk yang SUDAH ADA jadi lebih editorial/lifestyle). JANGAN cuma deskripsi ruangan/tekstur kosong seperti \"minimalist living room, soft daylight\" — itu masih terasa seperti foto produk ditempel background baru. Bayangkan sebuah MOMEN NARATIF nyata yang sedang terjadi dan tuliskan settingnya lengkap dengan implied activity/ambient life di sekitarnya, contoh gaya yang benar: \"stepping through an open doorway into a sunlit courtyard as if arriving at a warm family gathering, soft golden afternoon light, blurred figures and a table with food softly out of focus in the background, gentle breeze, candid editorial moment\" atau \"pausing by a window with a cup of tea on a quiet morning, soft morning light streaming in, a half-open book and fresh flowers on the sill, calm intimate mood\". Sertakan: (1) momen/aktivitas tersirat, (2) setting/lighting, (3) elemen ambient/props pendukung cerita. Fokus pada suasana & cerita DI SEKITAR model (bukan wajah/baju model itu sendiri — itu tetap dijaga sistem lain), tapi pose/gestur model BOLEH menyesuaikan cerita secara natural. Isi string kosong \"\" kalau menurutmu foto studio polos yang sudah ada sudah cukup dan tidak perlu di-generate ulang.",
  "ATURAN ANTI-HALUSINASI (WAJIB): JANGAN mengarang bahan/harga/diskon/testimoni/statistik/jumlah stok yang tidak ada di data produk di bawah. Bahasa mood/emosional umum yang tidak mengklaim fakta spesifik itu boleh.",
].join("\n");

function buildHeadlineUserPrompt(input: SuggestHeadlineInput): string {
  const { product, theme, extraNotes } = input;
  return [
    "DATA PRODUK (fakta, jangan tambah-tambahi):",
    `- Kode: ${product.kode}`,
    `- Nama: ${product.nama}`,
    product.bahan ? `- Bahan: ${product.bahan}` : null,
    product.warna?.length ? `- Warna tersedia: ${product.warna.join(", ")}` : null,
    "",
    `TEMA POSTINGAN: ${THEME_LABELS[theme]}`,
    THEME_GUIDANCE[theme],
    extraNotes?.trim() ? `\nCATATAN TAMBAHAN DARI ADMIN (boleh dipakai sbg fakta):\n${extraNotes.trim()}` : "",
    "",
    "Sarankan headline poster sesuai format JSON yang diminta di system prompt.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function parseHeadlineOutput(raw: string): SuggestHeadlineResult {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gagal membaca saran headline dari AI (format tidak dikenali)");
    parsed = JSON.parse(match[0]);
  }

  const obj = parsed as {
    headline?: unknown;
    subtitle?: unknown;
    bottomCaption?: unknown;
    sceneIdea?: unknown;
  };

  const headline: SuggestHeadlineLine[] = Array.isArray(obj.headline)
    ? obj.headline
        .filter(
          (l): l is { text: string; script?: boolean } =>
            !!l && typeof l === "object" && typeof (l as { text?: unknown }).text === "string" && (l as { text: string }).text.trim() !== ""
        )
        .slice(0, 3)
        .map((l) => ({ text: l.text.trim(), script: Boolean(l.script) }))
    : [];

  if (headline.length === 0) {
    throw new Error("AI tidak menghasilkan headline yang valid, coba generate ulang");
  }

  return {
    headline,
    subtitle: typeof obj.subtitle === "string" && obj.subtitle.trim() ? obj.subtitle.trim() : undefined,
    bottomCaption:
      typeof obj.bottomCaption === "string" && obj.bottomCaption.trim() ? obj.bottomCaption.trim() : undefined,
    sceneIdea: typeof obj.sceneIdea === "string" && obj.sceneIdea.trim() ? obj.sceneIdea.trim() : undefined,
  };
}

export async function suggestHeadline(input: SuggestHeadlineInput): Promise<SuggestHeadlineResult> {
  const result = await generateText({
    prompt: buildHeadlineUserPrompt(input),
    systemPrompt: HEADLINE_SYSTEM_PROMPT,
    temperature: 1,
    maxTokens: 400,
  });

  return parseHeadlineOutput(result.output);
}

// --- Storyboard carousel ("Generate Alur Cerita") ---
// Beda dari suggestHeadline() di atas (yang cuma menyarankan SATU sceneIdea
// buat background poster/slide pertama): ini menyarankan BEBERAPA scene
// SEKALIGUS yang saling terhubung sebagai satu alur cerita — dipakai admin
// utk mengisi arahan tiap slide carousel foto marketing (lihat panel "Foto
// Marketing AI" per-slide di app/content/page.tsx). Tujuannya: hindari tiap
// slide terasa acak/redundan (masalah nyata yang dilaporkan admin — 3 foto
// hasil generate independen terasa "cerita yang sama", bukan progresif),
// dengan cara satu pemanggilan LLM yang sadar akan JUMLAH slide sekaligus,
// diminta merancang alur (awal→tengah→akhir atau semacamnya) dalam SATU
// setting/mood/hari yang sama, tiap beat scene/aktivitas/framing yang
// beda-beda secara visual.

export interface SuggestStoryboardInput {
  product: CaptionProductContext;
  theme: ContentTheme;
  extraNotes?: string;
  sceneCount: number; // jumlah slide/foto yang dipilih admin (2-10)
}

export interface StoryboardScene {
  label: string; // label singkat beat cerita, mis. "Bersiap di depan cermin"
  sceneIdea: string; // Bahasa Inggris, dipakai lib/prompts/marketing-photo.ts
}

export interface SuggestStoryboardResult {
  scenes: StoryboardScene[];
}

const STORYBOARD_SYSTEM_PROMPT = [
  "Kamu adalah social media specialist & creative director top-tier untuk Deera Indonesia, brand fashion muslim (gamis & mukena) asal Indonesia, yang sedang merancang STORYBOARD untuk satu post carousel Instagram.",
  "Tugasmu: rancang SATU alur cerita/momen yang utuh, terbagi jadi beberapa 'scene' berurutan — SATU scene untuk SATU foto/slide di carousel. Ini BUKAN beberapa ide acak yang kebetulan pakai produk yang sama — semua scene harus terasa seperti bagian dari SATU cerita/hari/momen yang sama (setting, mood, waktu, dan nuansa emosional yang konsisten), supaya kalau audiens geser slide demi slide, mereka merasa mengikuti sebuah cerita yang mengalir dan brand-nya makin nempel di ingatan — bukan cuma lihat 3-10 foto produk yang mirip-mirip dari sudut berbeda.",
  "SETIAP scene HARUS beda secara visual dari scene lain (aktivitas/gestur/framing/sudut/bagian dari setting yang ditonjolkan berbeda) supaya tidak terasa redundan, TAPI tetap konsisten satu dunia/cerita yang sama (lokasi/rangkaian ruang yang sama atau berdekatan, waktu hari yang masuk akal, mood emosional yang sama). Pikirkan seperti storyboard film pendek 15 detik: shot 1 beda dari shot 2 beda dari shot 3, tapi semuanya jelas dari cerita yang sama.",
  "Urutan yang disarankan (boleh disesuaikan tema): scene pembuka (mis. bersiap/momen tenang di awal), 1+ scene tengah (aktivitas/transisi/interaksi dengan sekitar), scene penutup (mis. momen puncak/rehat/refleksi). Untuk tema 'Tips & Styling' atau 'Promo/CTA' boleh disesuaikan supaya tetap relevan temanya, tapi progresi/kontinuitas cerita tetap wajib ada.",
  "Balas HANYA dalam format JSON PERSIS berikut, tanpa teks/markdown lain di luar JSON:",
  '{"scenes":[{"label":"...","sceneIdea":"..."}, ...]}',
  "Jumlah item di 'scenes' HARUS PERSIS sama dengan jumlah yang diminta di data di bawah (sceneCount).",
  "'label': label pendek Bahasa Indonesia (maks ~6 kata) buat admin, mis. 'Bersiap di depan cermin'.",
  "'sceneIdea': SATU arahan CERITA/MOMEN dalam BAHASA INGGRIS sederhana (dipakai AI image-generator lain utk merestyle sebuah foto produk yang SUDAH ADA jadi lebih editorial/lifestyle, model & baju tetap 100% sama, cuma suasana/pose yang menyesuaikan cerita). JANGAN cuma deskripsi ruangan/tekstur kosong — bayangkan momen naratif nyata yang sedang terjadi, sertakan implied activity/ambient life di sekitarnya. Tiap sceneIdea harus jelas beda dari sceneIdea lain di array ini (aktivitas/framing/fokus berbeda), tapi tetap konsisten dari segi lokasi/waktu/mood dengan scene lain supaya berasa satu cerita yang sama.",
  "ATURAN ANTI-HALUSINASI (WAJIB): JANGAN mengarang bahan/harga/diskon/testimoni/statistik/jumlah stok yang tidak ada di data produk di bawah. Bahasa mood/emosional umum yang tidak mengklaim fakta spesifik itu boleh.",
].join("\n");

function buildStoryboardUserPrompt(input: SuggestStoryboardInput): string {
  const { product, theme, extraNotes, sceneCount } = input;
  return [
    "DATA PRODUK (fakta, jangan tambah-tambahi):",
    `- Kode: ${product.kode}`,
    `- Nama: ${product.nama}`,
    product.bahan ? `- Bahan: ${product.bahan}` : null,
    product.warna?.length ? `- Warna tersedia: ${product.warna.join(", ")}` : null,
    "",
    `TEMA POSTINGAN: ${THEME_LABELS[theme]}`,
    THEME_GUIDANCE[theme],
    extraNotes?.trim() ? `\nCATATAN TAMBAHAN DARI ADMIN (boleh dipakai sbg fakta):\n${extraNotes.trim()}` : "",
    "",
    `JUMLAH SLIDE/SCENE YANG DIBUTUHKAN (sceneCount): ${sceneCount}`,
    "Rancang storyboard sesuai format JSON yang diminta di system prompt — persis sceneCount item, satu alur cerita yang utuh.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function parseStoryboardOutput(raw: string, sceneCount: number): SuggestStoryboardResult {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Gagal membaca storyboard dari AI (format tidak dikenali)");
    parsed = JSON.parse(match[0]);
  }

  const obj = parsed as { scenes?: unknown };
  const scenes: StoryboardScene[] = Array.isArray(obj.scenes)
    ? obj.scenes
        .filter(
          (s): s is { label: string; sceneIdea: string } =>
            !!s &&
            typeof s === "object" &&
            typeof (s as { sceneIdea?: unknown }).sceneIdea === "string" &&
            (s as { sceneIdea: string }).sceneIdea.trim() !== ""
        )
        .slice(0, sceneCount)
        .map((s) => ({
          label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : "Scene",
          sceneIdea: s.sceneIdea.trim(),
        }))
    : [];

  if (scenes.length === 0) {
    throw new Error("AI tidak menghasilkan storyboard yang valid, coba generate ulang");
  }

  return { scenes };
}

export async function suggestStoryboard(input: SuggestStoryboardInput): Promise<SuggestStoryboardResult> {
  const result = await generateText({
    prompt: buildStoryboardUserPrompt(input),
    systemPrompt: STORYBOARD_SYSTEM_PROMPT,
    temperature: 1,
    maxTokens: 900,
  });

  return parseStoryboardOutput(result.output, input.sceneCount);
}
