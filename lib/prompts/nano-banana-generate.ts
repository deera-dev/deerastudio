// Mesin generate utama — "Opsi B" (Agustus 2026): satu pemanggilan Nano
// Banana Pro (fal-ai/nano-banana-pro/edit) menggantikan pipeline lama
// FASHN VTO + Kontext (2 tahap).
//
// LATAR BELAKANG: pemilik produk membuktikan sendiri lewat tes manual di
// Gemini bahwa pendekatan "banyak foto referensi ASLI model + banyak foto
// produk ASLI + 1 prompt sangat detail" jauh lebih akurat menjaga motif/
// tekstur produk dibanding model VTO sempit (FASHN/FLUX) yang cuma nerima
// 2 foto tanpa instruksi teks. Nano Banana Pro (Gemini 3 Pro Image) dites
// terbukti cocok karena API-nya (image_urls: string[]) menerima BANYAK
// foto sekaligus + 1 prompt bebas — persis pola yang sudah berhasil itu.
//
// PERBEDAAN dari pipeline lama:
// - TIDAK ADA compositing foto produk (lib/images/composite-garment.ts) —
//   semua foto produk yang diupload dikirim APA ADANYA sebagai entri
//   terpisah di image_urls, Nano Banana Pro cukup pintar membedakan &
//   menggabungkan info dari tiap foto lewat instruksi di prompt.
// - Identitas model diperkuat dengan 1-2 foto pose LAIN dari model yang
//   sama (bukan cuma foto pose target), meniru pola 4-foto-referensi yang
//   terbukti berhasil di tes manual.
// - Background/aksesoris dijelaskan lewat teks di prompt (bukan tahap
//   Kontext terpisah) — jadi identitas, produk, DAN background sekarang
//   selesai dalam SATU pass, mengurangi jumlah generasi diffusion
//   berturut-turut yang selama ini jadi sumber drift wajah.
// - Foto "detail"/"seri" (crop/zoom dari foto utama) TETAP pakai Kontext
//   (lib/prompts/stage2.ts runDetailCrop) — itu operasi reframe murni,
//   bukan re-render produk dari nol, jadi tidak perlu ganti & tetap murah.
//
// REVISI (Agustus 2026 — admin: "untuk foto yang bagian belakang itu,
// jilbabnya selalu menutupi produknya, bisa ga diset foto belakang itu
// pakai model jilbab yang pendek aja"): utk role "angle" (isBackView),
// klausa 6 STYLING sekarang WAJIB jilbab PENDEK (selutut bahu, bukan
// draping panjang) supaya seluruh bagian belakang garment (panel, closure,
// bordir, jahitan, hem) tidak tertutup kain jilbab — berlaku PERMANEN utk
// semua foto "angle" ke depan, bukan cuma sekali perbaikan lewat
// correctionNote. Klausa 4 POSE & FRAMING (back view) juga dikoreksi —
// sebelumnya malah eksplisit minta AI reproduksi "hijab drape from behind"
// dari foto referensi pose belakang, yang KONTRADIKTIF sama tujuan ini
// (foto referensi pose belakang kemungkinan besar jilbabnya juga panjang,
// dan model AI cenderung niru struktur visual referensi drpd instruksi
// teks generik — pelajaran yang sama dari REVISI #8/#9 di app/api/
// generate-set/route.ts) — klausa baru eksplisit bilang "even if the
// MODEL REFERENCE shows a longer hijab, shorten it for this shot".
//
// REVISI (Agustus 2026 — admin konfirmasi klausa 6 di atas TERNYATA BELUM
// CUKUP: "saya juga masih melihat hasil tampak belakang, kerudungnya masih
// panjang sehingga menutupi detail produk belakangnya"): klausa 6 ditulis
// ulang jadi jauh lebih tegas/tidak bersyarat ("MANDATORY, NON-NEGOTIABLE",
// "OVERRIDES every reference image without exception") + ditambah 1 baris
// verifikasi ulang khusus hijab di penutup prompt (sebelum "Produce ONE
// final image") — reinforcement lewat REPETISI teks di 2 titik berbeda
// dlm prompt. CATATAN JUJUR ke diri sendiri/admin: ini kemungkinan tetap
// cuma perbaikan PARSIAL — akar masalah yang sebenarnya (sesuai pelajaran
// REVISI #8/#9) kemungkinan besar foto referensi "Pose Belakang" itu SENDIRI
// menunjukkan model pakai jilbab panjang, dan model AI historically lebih
// niru struktur VISUAL referensi drpd instruksi teks sekuat apapun. Perbaikan
// paling reliable kemungkinan besar tetap: re-tag/upload foto "Pose Belakang"
// baru yang modelnya SUDAH pakai jilbab pendek dari awal (app/poses/page.tsx)
// — belum diusulkan/dikonfirmasi ke admin, prompt-only fix ini dicoba dulu.
//
// REVISI (Agustus 2026 — admin: "foto produk di halaman generate masih
// banyak hilang detail dan tidak sesuai, apalagi yang bisa kita adjust
// agar produknya bisa semirip mungkin ya?"): dua parameter API Nano Banana
// Pro yang sebelumnya dipasang konservatif tanpa alasan kuat, sekarang
// dinaikkan (lihat runNanoBananaGenerate di bawah) — resolution "1K" ->
// "2K" (dicek ke fal.ai, harganya SAMA, $0.15/gambar, cuma 4K yang 2x
// lipat) & output_format "jpeg" -> "png" (lossless, jpeg lama bisa
// nge-blur tekstur/bordir halus lewat kompresi). Kedua perubahan ini
// murni upside (tidak nambah biaya generate) tapi TIDAK menjamin
// menyelesaikan semua kasus "detail hilang" — kalau motif/bordir memang
// rumit & TIDAK ada foto referensi close-up-nya (productImages di
// app/generate/page.tsx: hanya "Depan" yang wajib, 6 slot detail lainnya
// opsional), model AI tetap harus menebak area yang tidak difoto. Upload
// foto detail (dada/leher/lengan/tangan/bawah) yang RELEVAN dgn motif
// produk itu tetap cara paling efektif menaikkan fidelity, di luar
// perubahan teknis ini.
//
// REVISI BESAR (Agustus 2026 — masukan admin, hasil analisis eksternal yang
// diverifikasi & diadaptasi, BUKAN dicopy mentah): diagnosis intinya prompt
// LAMA memperlakukan tugas ini sebagai "buat foto baru" (CORE RULE lama:
// "only clothing, pose, background should change" — dibaca AI sbg "boleh
// nge-generate ulang clothing-nya"), padahal maksudnya adalah GARMENT
// TRANSFER: foto flat-lay adalah BLUEPRINT produk fisik yang sudah ada,
// bukan bahan re-desain. Perubahan konkret di buildPrompt():
// 1. Framing PRODUCT REFERENCE diubah eksplisit jadi "FLAT-LAY PHOTOGRAPHS
//    OF THE ACTUAL PHYSICAL GARMENT... blueprint... absolute source of
//    truth", CORE RULE ditulis ulang menegaskan "NOT an invitation to
//    design a new outfit".
// 2. Klausa 2 (GARMENT FIDELITY) + 2a (print density) digabung ulang jadi
//    "GARMENT IDENTITY — ABSOLUTE PRIORITY" + klausa baru 2a "FLAT-LAY TO
//    BODY TRANSFER" yang eksplisit bilang: rekonstruksi garment DI ATAS
//    tubuh model dari flat-lay (bukan generate baju baru "mirip" flat-lay),
//    natural fabric deformation dari pose BOLEH, design changes TIDAK BOLEH.
// 3. Klausa 4 (POSE) ditambah bahasa "natural body language" (relaxed
//    shoulders, natural weight shift, dst) supaya AI tidak menghasilkan
//    pose kaku/mannequin-like — tanpa mengorbankan visibilitas garment.
// 4. Klausa 6 (STYLING) ditambah kalimat "the hijab is secondary to the
//    garment" sbg penguat tambahan (lihat REVISI hijab di atas).
// 5. Klausa 9 diperluas jadi "NO HALLUCINATION, NO AESTHETIC UPGRADE" —
//   AI punya bias memperindah/mensimetriskan produk fashion, sekarang
//   eksplisit dilarang ("commercial accuracy > aesthetic improvement").
// 6. GarmentReference/PRODUCT REFERENCE MAP (BARU, lihat di bawah) — dulu
//    garmentImageUrls cuma array URL polos tanpa konteks, AI harus menebak
//    sendiri gambar mana front/back/detail dada/dst dari isi visual saja.
//    Sekarang tiap foto produk dikirim berpasangan dgn LABEL perannya
//    (front/back/detailChest/dst, lihat GARMENT_LABELS & GarmentReference),
//    dan buildPrompt() mencantumkan "PRODUCT REFERENCE MAP" eksplisit di
//    awal prompt (PRODUCT REFERENCE 1 = ..., PRODUCT REFERENCE 2 = ..., dst)
//    yg urutannya PERSIS sama dgn urutan gambar itu muncul di image_urls —
//    supaya AI tahu persis foto mana yg boleh dipakai utk apa (mis. jangan
//    pakai foto detail lengan utk menebak motif dada), bukan cuma menebak
//    dari isi visual semata. Dipakai bareng2 oleh generate-set/route.ts &
//    generations/[id]/regenerate/route.ts lewat collectGarmentReferences().
// 7. MODE REFINE/KOREKSI BARU (runNanoBananaRefine, lihat di bawah) —
//    sebelumnya SEMUA regenerate (termasuk yg cuma soal pose/background/
//    ketajaman, garment-nya sendiri sudah benar) tetap full re-render dari
//    flat-lay + pose + identity lewat buildPrompt() biasa — itu justru
//    membuka ruang AI "mendesain ulang" garment yang sebenarnya sudah oke,
//    salah satu kemungkinan akar masalah laporan "detail hilang" yang
//    berulang. Mode baru ini (dipicu admin via checkbox "Kunci Produk" di
//    dialog regenerate — lihat components/ui/PromptDialog.tsx & app/api/
//    generations/[id]/regenerate/route.ts) TIDAK mengirim flat-lay/pose/
//    identity reference SAMA SEKALI — hanya foto HASIL SEBELUMNYA (+
//    correction reference opsional) dgn prompt pendek yang eksplisit bilang
//    garment SUDAH DISETUJUI dan harus dipertahankan persis, AI cuma boleh
//    ubah apa yang diminta di correctionNote (pose/background/ketajaman/dst).
import { fal, FAL_MODELS } from "../fal/client";

// --- Referensi produk berlabel (PRODUCT REFERENCE MAP) --------------------

export type ProductImagesShape = {
  front: string;
  back?: string;
  detailNeck?: string;
  detailSleeve?: string;
  detailHand?: string;
  detailChest?: string;
  detailHem?: string;
  fullBody?: string;
};

export interface GarmentReference {
  url: string;
  // Deskripsi peran foto ini utk PRODUCT REFERENCE MAP di prompt — TIDAK
  // dikirim ke API scr terpisah per-gambar (fal-ai nano-banana-pro/edit cuma
  // terima image_urls: string[] flat, tanpa metadata per-entri), jadi
  // "label"-nya cuma valid selama urutan garmentReferences PERSIS sama dgn
  // urutan kemunculannya di image_urls — dijaga oleh runNanoBananaGenerate.
  label: string;
}

const GARMENT_LABELS: Record<keyof ProductImagesShape, string> = {
  front:
    "FRONT FLAT-LAY — overall front construction, silhouette, print placement, and proportions",
  detailChest:
    "CHEST DETAIL — use ONLY to inspect embroidery, print, texture, buttons, and construction around the chest",
  detailNeck:
    "NECK DETAIL — use ONLY to inspect neckline, collar, and surrounding construction",
  detailSleeve:
    "SLEEVE DETAIL — use ONLY to inspect sleeve construction and fabric detail",
  detailHand:
    "CUFF/WRIST DETAIL — use ONLY to inspect cuff, wrist, and button detail",
  detailHem:
    "HEM DETAIL — use ONLY to inspect the lower garment, hem, and border",
  back:
    "BACK FLAT-LAY — rear construction; this is the PRIORITY source for any back-view photograph",
  fullBody:
    "FULL-BODY FLAT-LAY — use to verify overall garment proportions and silhouette",
};

// Urutan tetap — sama persis dgn urutan collectGarmentUrls() versi lama,
// dipertahankan supaya perilaku existing (mis. foto mana yg lebih dulu
// muncul) tidak berubah drastis di luar penambahan label.
const GARMENT_ORDER: (keyof ProductImagesShape)[] = [
  "front",
  "detailChest",
  "detailNeck",
  "detailSleeve",
  "detailHand",
  "detailHem",
  "back",
  "fullBody",
];

// Dipanggil dari app/api/generate-set/route.ts & app/api/generations/[id]/
// regenerate/route.ts — ganti fungsi collectGarmentUrls() lama yg dulu
// duplikat identik di kedua file itu (skrg dipusatkan di sini).
export function collectGarmentReferences(images: ProductImagesShape): GarmentReference[] {
  return GARMENT_ORDER.map((key) => {
    const url = images[key];
    return url ? { url, label: GARMENT_LABELS[key] } : null;
  }).filter((r): r is GarmentReference => r !== null);
}

// REVISI (Agustus 2026, sepaket dgn klausa 2a): utk foto "angle" (back
// view), foto referensi produk yang menunjukkan BELAKANG garment
// (productImages.back) dipindah jadi entri produk PERTAMA — menguatkan
// klausa 2c (BACK VIEW REFERENCE PRIORITY) secara visual, bukan cuma lewat
// teks. Ganti prioritizeUrl(string[]) versi lama — sekarang beroperasi di
// atas GarmentReference[] supaya label ikut pindah bareng URL-nya.
export function prioritizeReference(
  refs: GarmentReference[],
  priorityUrl: string | undefined | null
): GarmentReference[] {
  if (!priorityUrl) return refs;
  const idx = refs.findIndex((r) => r.url === priorityUrl);
  if (idx === -1) return refs;
  return [refs[idx], ...refs.filter((_, i) => i !== idx)];
}

// --- Generate penuh dari flat-lay (utama / angle / seri) -------------------

export interface NanoBananaGenerateInput {
  poseImageUrl: string; // foto model pada pose TARGET (ai_poses.reference_image_url)
  identityReferenceUrls?: string[]; // foto lain model yg sama — penguat identitas, opsional tp direkomendasikan
  garmentReferences: GarmentReference[]; // SEMUA foto produk asli yang diupload, berlabel peran (lihat collectGarmentReferences) — tidak dikomposit
  backgroundDescription: string; // dari composeBackground()
  productWarna?: string;
  accessoryPromptFragments?: string[];
  seed?: number;
  // REVISI Agustus 2026 (seri hemat-foto): true KHUSUS utk role "seri" —
  // garmentReferences di call ini adalah CAMPURAN 2 warna (semua foto warna
  // utama/default + 1 foto warna target warna itu sendiri), lihat catatan
  // di app/api/generate-set/route.ts. Prompt butuh instruksi tambahan (lihat
  // klausa 2b di buildPrompt) supaya AI tidak salah warna/tidak nge-blend
  // 2 warna jadi satu.
  isColorVariant?: boolean;
  // REVISI #8 (Agustus 2026, "4 foto tetap" — angle disederhanakan jadi
  // BELAKANG tanpa pilih pose per-generate): true KHUSUS utk role "angle".
  // REVISI #9 (segera setelah #8 gagal di tes nyata — hasil "angle" malah
  // keluar foto DEPAN lagi): coba #8 pakai poseImageUrl yang SAMA dgn utama
  // + instruksi teks "putar ke belakang" — TERBUKTI tidak reliable, model AI
  // lebih niru struktur visual foto referensi drpd ikutin instruksi teks.
  // Sekarang poseImageUrl utk role "angle" adalah foto referensi ASLI yang
  // sudah menunjukkan belakang model (ai_poses.is_back_view, ditandai admin
  // SEKALI per model di halaman Poses — lihat app/api/generate-set/route.ts
  // REVISI #9), dan flag ini cuma REINFORCEMENT teks tambahan di buildPrompt
  // (menegaskan "wajah tidak boleh terlihat, ini foto belakang"), bukan lagi
  // satu-satunya sinyal yang menentukan arah foto.
  isBackView?: boolean;
  // REVISI (Agustus 2026 — admin regenerate berkali-kali di History tapi
  // hasilnya masih belum sesuai, tanya "bisa ga kita kasih prompt lagi buat
  // benerin dibandingkan generate dari awal?"): sebelumnya "Generate Ulang"
  // cuma re-roll seed acak dgn prompt yang PERSIS SAMA — kalau masalahnya
  // spesifik (mis. "background kurang terang", "pose kaku", "kain kurang
  // jatuh natural"), admin tidak ada cara kasih tahu AI apa yang mau
  // diperbaiki, cuma bisa coba-coba lagi & berharap random seed beda hasil.
  // Field ini diisi dari catatan bebas yang admin ketik di dialog konfirmasi
  // regenerate (lihat components/ui/PromptDialog.tsx & app/history/
  // page.tsx handleRegenerate) — HANYA dipakai saat regenerate satu foto
  // (app/api/generations/[id]/regenerate/route.ts), TIDAK dipakai saat
  // generate-set awal (belum ada "hasil sebelumnya" utk dikoreksi).
  // CATATAN: kalau admin centang "Kunci Produk" di dialog, correctionNote
  // ini TIDAK lewat sini sama sekali — dialihkan ke runNanoBananaRefine()
  // di bawah (mode berbeda, tidak generate ulang dari flat-lay).
  // Ditempel di buildPrompt() sbg klausa prioritas TINGGI di awal prompt.
  correctionNote?: string;
  // REVISI (Agustus 2026, segera setelah correctionNote di atas — admin:
  // "cuma saya gabisa kasih image referencenya, bakal lebih bagus kalau
  // saya bisa kasih prompt buat benerin beserta dengan image yang saya
  // maksud"), lalu DIPERLUAS (Agustus 2026 — admin: "di bagian generate
  // ulang juga cuma bisa upload 1 image aja, lebih bagus bisa banyak, dan
  // ada reference dari hasil yang di generate sebelumnya"): dua sumber foto
  // referensi TAMBAHAN opsional dipisah jadi dua field berbeda supaya
  // masing-masing bisa dijelaskan dgn peran berbeda di prompt:
  correctionReferenceUrls?: string[]; // sampai 3 foto yg admin upload SENDIRI di dialog regenerate (components/ui/PromptDialog.tsx) — contoh visual dari apa yg dimaksud correctionNote.
  // Foto HASIL GENERATE SEBELUMNYA milik baris yang sedang diregenerate
  // (gen.output_image_url, diambil OTOMATIS server-side sebelum baris itu
  // ditimpa — lihat app/api/generations/[id]/regenerate/route.ts) — admin
  // TIDAK perlu upload manual, AI langsung lihat persis apa yg salah dari
  // percobaan terakhir, bukan cuma menebak dari deskripsi teks correctionNote.
  previousResultUrl?: string;
}

export interface NanoBananaGenerateResult {
  imageUrl: string;
  seed: number;
  description: string;
  generationTimeMs: number;
}

function buildPrompt(input: NanoBananaGenerateInput): string {
  const accessoryClause = input.accessoryPromptFragments?.length
    ? input.accessoryPromptFragments.join(", ")
    : "";

  const modelRefCount = 1 + (input.identityReferenceUrls?.length ?? 0);
  const referenceMapText = input.garmentReferences.length
    ? [
        `PRODUCT REFERENCE MAP: the ${input.garmentReferences.length} PRODUCT REFERENCE image(s) below appear immediately after the ${modelRefCount} MODEL REFERENCE image(s) provided above, in this exact order:`,
        ...input.garmentReferences.map((r, i) => `PRODUCT REFERENCE ${i + 1} = ${r.label}.`),
      ].join("\n")
    : "";

  return [
    "You are an expert in professional fashion photography, garment visualization, and high-fidelity image editing.",
    "",
    "You are given: (1) one or more MODEL REFERENCE images of the same real female model — these establish ONLY her exact face, identity, body proportions, hands, and pose/body language; the clothing she happens to be wearing in these images is NOT the product and must be ignored entirely. (2) one or more PRODUCT REFERENCE images — these are FLAT-LAY PHOTOGRAPHS OF THE ACTUAL PHYSICAL GARMENT that must be worn by the model. They are not inspiration, not a style example, not a similar-looking product — they are the exact physical product, photographed flat. Treat them as a garment blueprint and the ABSOLUTE SOURCE OF TRUTH for everything about the clothing.",
    "",
    referenceMapText,
    "",
    "SUMMARY: the MODEL REFERENCE determines WHO is in the photo. The PRODUCT REFERENCE determines WHAT she is wearing. Never let one influence the other.",
    "",
    "TASK: place the EXACT physical garment shown in the PRODUCT REFERENCE (flat-lay) images onto the body of the SAME MODEL from the MODEL REFERENCE images, in a new pose and setting described below. This is a garment-transfer task, not a new fashion design task. The result must look like a real professional photograph from the same brand's catalog, not an AI-generated image.",
    "",
    "CORE RULE: this is NOT an invitation to design a new outfit. You already have the exact real garment (the PRODUCT REFERENCE flat-lay images) — your job is to dress the model in THAT EXACT garment, unchanged, and only vary her pose and the background. Do not redesign, reinterpret, simplify, beautify, modernize, or improve the garment in any way, and do not blend any clothing details from the MODEL REFERENCE images into it (those old clothes exist only to show who the model is, never what she should wear).",
    "",
    input.correctionNote
      ? [
          `CORRECTION FROM ART DIRECTOR (read this first, highest priority — a previous attempt at this exact photo had a specific problem that needs fixing): "${input.correctionNote}".`,
          input.previousResultUrl
            ? " You are also given a PREVIOUS ATTEMPT image — this is EXACTLY what was produced last time for this same photo, and it is what the correction note above is describing a problem with. Study it carefully to see precisely what is wrong before generating the corrected version — do not simply repeat the same mistake again. Do not copy the previous attempt's pose or framing if the note asks to change it; only preserve what the note does NOT ask to fix."
            : "",
          input.correctionReferenceUrls?.length
            ? ` ${input.correctionReferenceUrls.length} additional CORRECTION REFERENCE image(s) have also been provided by the art director, separate from the previous attempt — they show what is wanted INSTEAD (may show a desired pose, camera framing, background mood/setting, or a specific garment detail to fix). Use them ONLY to understand and apply the specific correction described in the note above — they do NOT override the MODEL REFERENCE images for identity, nor the PRODUCT REFERENCE images for the garment's true color/pattern/construction.`
            : "",
          " Prioritize fixing this specific issue above all else in this new attempt, while still following every other rule in this brief (identity, garment fidelity, pose, background).",
        ]
          .filter(Boolean)
          .join("")
      : "",
    "",
    "1. MODEL IDENTITY (critical): use the exact same woman shown in the MODEL REFERENCE images. Preserve her face shape, eyes, eyebrows, nose, lips, jawline, skin tone, skin texture, body proportions, apparent height, physique, apparent age, hands, and fingers exactly. Do not generate a different woman, and do not beautify, slim, enlarge, age, de-age, or otherwise reshape her.",
    "",
    "2. GARMENT IDENTITY — ABSOLUTE PRIORITY (this is what the PRODUCT REFERENCE flat-lay images are for): the garment on the model must remain visually IDENTICAL to the PRODUCT REFERENCE flat-lay images once transferred onto her body. Preserve exactly: color and color relationships, fabric type and visible texture, print/motif/pattern (including its density — see 2a), embroidery and its placement, panel construction, seams, stitching, pleats, folds caused by construction, neckline, collar, sleeves and sleeve shape, cuffs, buttons, trims, decorative elements, garment length and width, silhouette, proportions, and hem shape. Do not simplify small details, do not replace detailed patterns with generic ones, do not hallucinate embroidery that isn't there, do not remove difficult details, do not invent anything not visible in the PRODUCT REFERENCE images. If a pattern is irregular or asymmetrical, keep it irregular. When there is ANY conflict between clothing visible in a MODEL REFERENCE image and the PRODUCT REFERENCE images, ALWAYS use the PRODUCT REFERENCE images.",
    "2a. FLAT-LAY TO BODY TRANSFER (critical — the PRODUCT REFERENCE images are photographed flat, not worn by anyone): reconstruct the garment on the model's body by preserving the actual construction and proportions visible in the flat-lay — do not treat the flat-lay as a loose illustration to reinterpret. Imagine the exact physical garment being carefully dressed onto the model: it may naturally develop realistic folds, tension, and draping because it is now being worn on a body, but its underlying construction, silhouette, pattern placement, panel boundaries, sleeve construction, neckline, cuffs, hem, and proportions must remain faithful to the flat-lay. Natural fabric deformation caused by the body and pose is allowed; design changes are NOT allowed. Additionally, if the fabric has a dense, continuous, all-over printed or textured pattern that covers the ENTIRE garment surface with no bare gaps in the flat-lay, that SAME density, scale, and continuous coverage must be reproduced across the ENTIRE visible garment once worn — every panel, sleeve, and fold must show the print, not just isolated patches. Do not thin out, sparsen, or fade a dense continuous print into a light scattered one, and do not let the print's color saturation wash out or go flat gray.",
    "",
    input.isColorVariant && input.productWarna
      ? `2b. MIXED COLOR REFERENCE HANDLING (critical): the PRODUCT REFERENCE images in this request show the SAME garment design in TWO different colorways — most of them are the brand's default/primary color, and exactly ONE photo shows the actual TARGET color for this output: "${input.productWarna}". Identify which reference photo's fabric color matches the name "${input.productWarna}" (see the PRODUCT REFERENCE MAP above for which entry this is) and use ONLY that photo as the source of truth for the garment's color and fabric shade. Use ALL the OTHER reference photos — regardless of their color — only for garment shape, cut, silhouette, embroidery pattern, motif placement, stitching, and construction detail; those structural details are identical across colorways and must not change. Do not blend, average, or mix the colors from different reference photos together — the final garment color must exactly match the single "${input.productWarna}" reference photo, nothing else.`
      : "",
    "",
    input.isBackView
      ? "2c. BACK VIEW REFERENCE PRIORITY (critical): the PRODUCT REFERENCE MAP above marks one image as the BACK FLAT-LAY — that image has the HIGHEST priority for all rear garment construction in this shot. Reproduce its back panel, closure, seams, and any back-facing embroidery/motif exactly. Do not invent a back design by guessing from the front reference, and do not borrow rear garment details from any MODEL REFERENCE image. If no dedicated back-view flat-lay is given, infer the back construction logically from the front/side reference photos (typical construction for this garment type), keeping the same fabric, color, and trims."
      : "",
    "",
    "3. GARMENT CONSTRUCTION: the clothing must behave like a real physical garment on her body — realistic fabric weight, natural draping, folds, wrinkles, and tension appropriate to the fabric shown in the PRODUCT REFERENCE images. Do not paint the garment onto her body. Do not make it tighter than the actual product's cut.",
    "",
    input.isBackView
      ? "4. POSE & BODY LANGUAGE (BACK VIEW — critical): one of the MODEL REFERENCE images already shows this exact model with her BACK to the camera — reproduce that same back-facing standing pose and camera framing, facing AWAY from the camera the entire time, showing the back of the garment FULLY VISIBLE (see clause 6 for the short-hijab requirement this depends on). Full body visible head to toe, face NOT visible anywhere in the image. Within that constraint, keep the posture relaxed and natural rather than mannequin-like — relaxed shoulders, natural arm position, slight natural weight shift, relaxed hands — but do not bend or twist the body in a way that distorts how the garment hangs or hides any back garment detail. Do not crop the garment."
      : "4. POSE & BODY LANGUAGE: a natural standing full-body fashion catalog pose, full body visible head to toe. Use the MODEL REFERENCE images primarily to preserve her exact identity, body proportions, and general pose/framing intent. The pose should look relaxed and natural rather than mannequin-like — subtle realistic asymmetry such as relaxed shoulders, natural arm position, slight natural weight shift, relaxed hands, and natural elbow positioning is encouraged. Do not create exaggerated fashion poses, and do not bend or twist the body in a way that changes how the garment should naturally hang or hides any garment detail. Do not crop the garment. Do not zoom into just the face.",
    "",
    `5. BACKGROUND & SETTING: ${input.backgroundDescription}. The background must complement the garment and remain secondary to it — clean, elegant, premium studio/interior atmosphere suitable for an established Indonesian Muslim fashion brand. No distracting objects, no fantasy environment, no obviously AI-generated background.`,
    "",
    input.isBackView
      ? "6. STYLING (BACK VIEW — MANDATORY, NON-NEGOTIABLE): the hijab in THIS image must be SHORT — cropped at or above shoulder length, ending well before it reaches the mid-back. This rule OVERRIDES every reference image without exception: even though the back-facing MODEL REFERENCE photo (and possibly other MODEL REFERENCE photos) shows this model wearing a LONGER hijab that drapes down her back, you must NOT copy that hijab length here — treat those reference photos as showing her FACE, HAIR-LINE, and BODY only, and deliberately shorten/crop the hijab in your output regardless of how it looks in every reference photo. The hijab is secondary to the garment: a hijab that reaches past the shoulder blades or covers any part of the garment's back panel is WRONG and must be corrected before finalizing. The entire back of the garment — back panel, closure, embroidery/motif, seams, hemline, from the shoulders all the way down — must be 100% visible with zero fabric obstruction. Natural makeup, minimal jewelry. Do not invent accessories that conflict with the product."
      : "6. STYLING: elegant modest hijab styling consistent with the MODEL REFERENCE images' brand language, natural makeup, minimal jewelry. Do not invent accessories that conflict with the product. If the PRODUCT REFERENCE images clearly include a matching hijab/inner/belt as part of the set, reproduce it accurately; otherwise do not add extra clothing items.",
    accessoryClause ? `Add these accessories if appropriate: ${accessoryClause}.` : "",
    input.productWarna
      ? `Hijab color and any visible footwear should coordinate with the garment's primary color: ${input.productWarna}.`
      : "",
    "",
    "7. LIGHTING & PHOTOGRAPHY STYLE: soft, controlled, even, natural-looking studio/catalog lighting — elegant, clean, premium, commercial, photorealistic. Avoid cinematic drama, excessive bokeh, HDR look, plastic skin, AI beauty-filter smoothing, or illustration/CGI appearance. The garment's color, texture, embroidery, and seams must all remain clearly visible and accurately lit — no highlights or shadows that hide garment details.",
    "",
    "8. HUMAN REALISM: realistic skin texture, anatomically correct hands and fingers (no extra or missing fingers, no deformed joints), natural limb proportions.",
    "",
    "9. NO HALLUCINATION, NO AESTHETIC UPGRADE: never invent product details not visible in the PRODUCT REFERENCE images — if a detail is hard to reproduce, preserve its visual structure rather than substituting a generic pattern. Do not make the garment prettier, cleaner, more luxurious, more symmetrical, or more fashionable than the real product — commercial accuracy is more important than aesthetic improvement. If the real product has an unusual, imperfect, irregular, asymmetric, or subtle detail, preserve it exactly rather than smoothing it out.",
    "",
    input.isBackView
      ? "Before finalizing, verify internally: is this clearly the same model? Does the garment match the PRODUCT REFERENCE (flat-lay) images in color, pattern, embroidery, silhouette, and proportions — as if it is the same physical product, not a redesign? Does it look like a real professional photograph? Is the hijab SHORT (shoulder-length or above) with the ENTIRE back of the garment visible — if the hijab in your draft is long or covers any garment detail, redo it shorter before finalizing, even though the reference photos show a longer hijab. If any product detail conflicts with what the model is wearing in the MODEL REFERENCE images, always prioritize the PRODUCT REFERENCE images."
      : "Before finalizing, verify internally: is this clearly the same model? Does the garment match the PRODUCT REFERENCE (flat-lay) images in color, pattern, embroidery, silhouette, and proportions — as if it is the same physical product, not a redesign? Does it look like a real professional photograph? If any product detail conflicts with what the model is wearing in the MODEL REFERENCE images, always prioritize the PRODUCT REFERENCE images.",
    "",
    "Produce ONE final photorealistic image.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runNanoBananaGenerate(
  input: NanoBananaGenerateInput
): Promise<NanoBananaGenerateResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  const imageUrls = [
    input.poseImageUrl,
    ...(input.identityReferenceUrls ?? []),
    ...input.garmentReferences.map((r) => r.url),
    // Urutan tidak diklaim eksplisit di prompt (previousResultUrl/
    // correctionReferenceUrls dijelaskan lewat KONTEN perannya, bukan posisi
    // — pola yg sama dipakai utk MODEL/PRODUCT REFERENCE di atas).
    ...(input.previousResultUrl ? [input.previousResultUrl] : []),
    ...(input.correctionReferenceUrls ?? []),
  ];

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildPrompt(input),
      image_urls: imageUrls,
      aspect_ratio: "3:4",
      // REVISI (Agustus 2026 — admin: "foto produk di halaman generate
      // masih banyak hilang detail dan tidak sesuai"): dicek langsung ke
      // fal.ai, 2K SAMA HARGANYA dgn 1K ($0.15/gambar keduanya — cuma 4K yg
      // 2x lipat, $0.30). Sebelumnya dipasang 1K padahal 2K gratis (tidak
      // nambah biaya) & tangkap detail bordir/motif kain jauh lebih tajam —
      // tidak ada alasan teknis buat tetap di 1K. output_format juga
      // diganti dari "jpeg" (lossy, kompresi bisa nge-blur tekstur halus)
      // ke "png" (lossless) — konsisten sama tujuan menjaga detail asli
      // produk, bukan cuma naikin resolusi tapi tetap dikompresi hilang.
      resolution: "2K",
      output_format: "png",
      seed,
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[]; description?: string };

  return {
    imageUrl: data.images[0].url,
    seed,
    description: data.description ?? "",
    generationTimeMs: Date.now() - startedAt,
  };
}

// --- Mode REFINE/KOREKSI (garment dikunci, bukan regenerate dari flat-lay) -

// Lihat REVISI BESAR poin 7 di header file utk latar belakang lengkap.
// Dipakai HANYA dari app/api/generations/[id]/regenerate/route.ts, HANYA
// saat admin centang "Kunci Produk" di dialog koreksi (components/ui/
// PromptDialog.tsx) DAN baris yg diregenerate sudah punya output_image_url
// (selalu ada, krn regenerate cuma jalan di baris yg sudah pernah generate).
function buildRefinePrompt(note: string, hasReferenceImages: boolean): string {
  return [
    "You are an expert photo retoucher making a small, targeted correction to an ALREADY-APPROVED fashion catalog photograph.",
    "",
    "You are given a PREVIOUS GENERATED IMAGE as the base. It has ALREADY been approved for model identity, garment design, garment color, garment pattern, garment construction, and background — preserve every one of those exactly, pixel-faithful where possible.",
    "",
    "DO NOT redesign, recolor, reconstruct, simplify, or replace the garment. DO NOT change the model's identity, face, or body proportions. DO NOT change the background, unless the correction below specifically asks you to.",
    "",
    `ONLY apply this specific correction, as narrowly as possible: "${note}"`,
    "",
    hasReferenceImages
      ? "Additional CORRECTION REFERENCE image(s) are also provided after the previous generated image — use them ONLY to understand what the correction should look like (e.g. a desired pose, framing, or mood), never as a new source for the garment or the model's identity."
      : "",
    "",
    "If the correction is about pose or body language, change ONLY the pose while keeping the exact same garment, face, and background. If the correction is about the background, change ONLY the background while keeping the model and garment exactly the same. If the correction is about image clarity or sharpness, improve photographic quality without altering any design element. For anything else, apply the correction as narrowly as possible without altering anything the note does not mention.",
    "",
    "Produce ONE photorealistic, high-resolution catalog photograph: the previous generated image with only the requested correction applied.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runNanoBananaRefine(input: {
  previousResultUrl: string;
  correctionNote: string;
  correctionReferenceUrls?: string[];
  seed?: number;
}): Promise<NanoBananaGenerateResult> {
  const startedAt = Date.now();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000_000);

  // Sengaja TIDAK ada poseImageUrl/identityReferenceUrls/garmentReferences
  // sama sekali di sini — itu inti bedanya dgn runNanoBananaGenerate(),
  // supaya AI tidak punya bahan utk "menggambar ulang" garment dari flat-lay,
  // cuma bisa edit foto yg sudah ada.
  const imageUrls = [input.previousResultUrl, ...(input.correctionReferenceUrls ?? [])];

  const result = await fal.subscribe(FAL_MODELS.NANO_BANANA, {
    input: {
      prompt: buildRefinePrompt(input.correctionNote, Boolean(input.correctionReferenceUrls?.length)),
      image_urls: imageUrls,
      aspect_ratio: "3:4",
      resolution: "2K",
      output_format: "png",
      seed,
    },
    logs: false,
  });

  const data = result.data as { images: { url: string }[]; description?: string };

  return {
    imageUrl: data.images[0].url,
    seed,
    description: data.description ?? "",
    generationTimeMs: Date.now() - startedAt,
  };
}
