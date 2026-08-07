// Gabungkan beberapa foto flat-lay produk (depan + foto detail lain) jadi
// SATU gambar komposit sebelum dikirim sebagai garment_image_url ke FLUX
// VTO. API fal-ai/flux-pro/v1/vto hanya menerima SATU garment_image_url
// (lihat catatan di lib/fal/vto.ts) — tapi dokumentasi resmi fal.ai
// menyarankan: "Multiple garments must be merged into a single composite
// image before submission." Composite ini memberi VTO info tekstur/motif
// dari beberapa sudut sekaligus (dada, leher, lengan, bawah, dst), bukan
// cuma satu foto depan yang mungkin kusut/kurang jelas — lihat diskusi di
// PRD/percakapan soal fidelity motif & tekstur kain (Agustus 2026).
import sharp, { type OverlayOptions } from "sharp";

export interface CompositeSource {
  url: string;
  label: string; // dipakai utk log/debug saja, tidak masuk ke gambar
}

// Target ukuran komposit: dijaga di sekitar 1MP, sesuai batas
// garment_image_url fal.ai (maks 1MP, direkomendasikan lebih kecil —
// lihat catatan di lib/supabase/storage.ts).
const CANVAS_SIZE = 1024;
const GAP = 6; // px pemisah putih antar tile — bantu model membedakan sudut foto berbeda

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengambil gambar untuk komposit (${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Pure & testable: susun buffer gambar (sudah di-fetch) jadi satu komposit.
// Foto pertama (index 0, selalu foto "depan") mendapat panel lebih besar di
// kiri karena paling merepresentasikan bentuk & motif keseluruhan produk;
// sisanya disusun grid kecil di kanan.
export async function composeFromBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (buffers.length === 0) {
    throw new Error("composeFromBuffers: buffers kosong");
  }

  if (buffers.length === 1) {
    return sharp(buffers[0])
      .resize(CANVAS_SIZE, CANVAS_SIZE, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  const frontWidth = Math.round(CANVAS_SIZE * 0.55);
  const restWidth = CANVAS_SIZE - frontWidth - GAP;
  const restBuffers = buffers.slice(1);
  const restCols = restBuffers.length <= 2 ? 1 : 2;
  const restRows = Math.ceil(restBuffers.length / restCols);
  const cellWidth = Math.floor((restWidth - (restCols - 1) * GAP) / restCols);
  const cellHeight = Math.floor((CANVAS_SIZE - (restRows - 1) * GAP) / restRows);

  const frontTile = await sharp(buffers[0])
    .resize(frontWidth, CANVAS_SIZE, { fit: "contain", background: "#ffffff" })
    .toBuffer();

  const restTiles = await Promise.all(
    restBuffers.map((buf) =>
      sharp(buf)
        .resize(cellWidth, cellHeight, { fit: "cover", position: "attention" })
        .toBuffer()
    )
  );

  const overlays: OverlayOptions[] = [{ input: frontTile, left: 0, top: 0 }];
  restTiles.forEach((tile, i) => {
    const col = i % restCols;
    const row = Math.floor(i / restCols);
    overlays.push({
      input: tile,
      left: frontWidth + GAP + col * (cellWidth + GAP),
      top: row * (cellHeight + GAP),
    });
  });

  return sharp({
    create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 3, background: "#ffffff" },
  })
    .composite(overlays)
    .jpeg({ quality: 90 })
    .toBuffer();
}

// Entry point: fetch semua sumber lalu susun jadi 1 komposit.
export async function compositeGarmentImages(sources: CompositeSource[]): Promise<Buffer> {
  if (sources.length === 0) {
    throw new Error("compositeGarmentImages: sources kosong");
  }
  const buffers = await Promise.all(sources.map((s) => fetchImageBuffer(s.url)));
  return composeFromBuffers(buffers);
}
