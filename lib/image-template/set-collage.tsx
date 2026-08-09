// Kolase "4 foto" untuk Generate/History (Agustus 2026) — dua template
// render TAMBAHAN di luar foto AI mentah (utama/angle), dibuat setelah
// admin kirim referensi lookbook nyata (foto profesional Deera) dan minta
// "generate set foto selalu menghasilkan 4 foto seperti itu": (1) utama,
// (2) angle/belakang, (3) KOLASE GABUNGAN — 2 foto (potret dekat + badan
// penuh) berdampingan, (4) KOLASE DETAIL — foto utama full-bleed + 2 foto
// close-up (kerah/manset) ditempel gaya polaroid berlabel "DETAIL".
//
// PENTING: kolase 3 & 4 BUKAN panggilan AI baru — cuma MENYUSUN ULANG foto
// yang sudah ada (foto utama/angle penuh + 2 crop close-up dari Kontext)
// jadi 1 gambar baru lewat rendering next/og (Satori), PERSIS pola yang
// sudah dipakai Poster AI (lib/image-template/poster.tsx) di Content
// Studio. Jadi TIDAK ADA biaya fal.ai tambahan utk kolase itu sendiri —
// biayanya cuma dari 2 foto sumber (utama+angle, Nano Banana Pro) + 2 crop
// close-up (Kontext) yang memang sudah diperlukan, lihat
// app/api/generate-set/route.ts.
//
// REVISI (Agustus 2026, segera setelah rilis pertama — admin: "ga perlu ada
// logo brandnya ya hapus aja logo brandnya"): logo brand (ikon+wordmark)
// yang tadinya nempel di kedua template DIHAPUS total. Ruang yang kosong
// dipakai memperbesar panel foto (kolase gabungan) — bukan cuma dibiarkan
// kosong.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen
// client.
import { ImageResponse } from "next/og";
import { loadFonts } from "./assets";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — konsisten dgn poster.tsx & rasio Instagram feed

// Warna latar krem hangat — meniru studio backdrop off-white di foto
// referensi lookbook admin (bukan putih pekat, sedikit warm supaya nyatu
// dgn nuansa gold/brand).
const BACKDROP = "#F7F2E9";
const INK = "#1F2A1C"; // hijau tua gelap — dipakai teks "DETAIL"

// ── Template 1: KOLASE GABUNGAN — potret dekat (kiri) + badan penuh
// (kanan) berdampingan di atas backdrop krem. Meniru referensi: dua foto
// model yang SAMA (produk yang sama) ditata bersisian seolah 1 spread
// majalah fashion.
export interface RenderKolaseGabunganInput {
  portraitUrl: string; // ditampilkan dgn crop condong ke atas (kesan potret dekat)
  fullBodyUrl: string; // ditampilkan penuh (badan lengkap)
}

export async function renderKolaseGabunganImageResponse(input: RenderKolaseGabunganInput) {
  const fonts = await loadFonts();

  // REVISI (logo dihapus) — topMargin sekarang cuma jarak dari tepi atas ke
  // panel foto (bukan lagi ruang utk lockup logo), jadi panel foto jauh
  // lebih besar dari versi ber-logo sebelumnya.
  const topMargin = 56;
  const panelBottom = 64;
  const fullBodyHeight = HEIGHT - topMargin - panelBottom;
  // Panel potret SENGAJA lebih PENDEK dari panel badan-penuh (keduanya
  // top-aligned, lihat alignItems: "flex-start" di bawah) — kombinasi
  // "box lebih pendek dari tinggi aslinya" + objectPosition "top" bikin
  // object-fit:cover otomatis crop ke arah wajah/bahu/dada (bukan badan
  // penuh), meniru foto potret dekat di referensi TANPA perlu generate
  // foto AI ke-3 (kolase ini murni compositing, lihat catatan atas file).
  const portraitHeight = fullBodyHeight * 0.56;
  const sideMargin = 56;
  const gapBetween = 14;
  const portraitWidth = (WIDTH - sideMargin * 2 - gapBetween) * 0.42;
  const fullBodyWidth = (WIDTH - sideMargin * 2 - gapBetween) * 0.58;

  const panelStyle = {
    display: "flex",
    overflow: "hidden",
    borderRadius: 4,
    boxShadow: "0 18px 40px -12px rgba(31,42,28,0.35)",
    backgroundColor: "#FFFFFF",
  } as const;

  const jsx = (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "Poppins",
        backgroundColor: BACKDROP,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          gap: gapBetween,
          marginTop: topMargin,
        }}
      >
        <div style={{ ...panelStyle, width: portraitWidth, height: portraitHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={input.portraitUrl}
            alt=""
            width={portraitWidth}
            height={portraitHeight}
            style={{
              width: portraitWidth,
              height: portraitHeight,
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        </div>
        <div style={{ ...panelStyle, width: fullBodyWidth, height: fullBodyHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={input.fullBodyUrl}
            alt=""
            width={fullBodyWidth}
            height={fullBodyHeight}
            style={{
              width: fullBodyWidth,
              height: fullBodyHeight,
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        </div>
      </div>
    </div>
  );

  return new ImageResponse(jsx, { width: WIDTH, height: HEIGHT, fonts });
}

export async function renderKolaseGabunganPng(input: RenderKolaseGabunganInput): Promise<Buffer> {
  const response = await renderKolaseGabunganImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Template 2: KOLASE DETAIL — foto utama full-bleed + 2 inset gaya
// polaroid (foto close-up kerah/manset, berlabel "DETAIL").
export interface RenderKolaseDetailInput {
  mainUrl: string; // foto utama/angle, full-bleed sbg latar
  detailUrl1: string; // crop close-up #1 (kerah/leher)
  detailUrl2: string; // crop close-up #2 (manset/lengan)
}

function PolaroidInset({
  src,
  width,
  height,
  rotateDeg,
  top,
  left,
}: {
  src: string;
  width: number;
  height: number;
  rotateDeg: number;
  top: number;
  left: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        padding: "10px 10px 16px",
        borderRadius: 3,
        boxShadow: "0 16px 32px -10px rgba(0,0,0,0.45)",
        transform: `rotate(${rotateDeg}deg)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={width}
        height={height}
        style={{ width, height, objectFit: "cover" }}
      />
      <span
        style={{
          display: "flex",
          marginTop: 10,
          fontFamily: "Poppins",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: 4,
          color: INK,
        }}
      >
        DETAIL
      </span>
    </div>
  );
}

export async function renderKolaseDetailImageResponse(input: RenderKolaseDetailInput) {
  const fonts = await loadFonts();

  const jsx = (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        position: "relative",
        fontFamily: "Poppins",
        backgroundColor: "#0f0c08",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={input.mainUrl}
        alt=""
        width={WIDTH}
        height={HEIGHT}
        style={{ position: "absolute", top: 0, left: 0, width: WIDTH, height: HEIGHT, objectFit: "cover" }}
      />

      {/* 2 inset polaroid — kerah/leher lebih atas, manset/lengan sedikit
          di bawah & kanan, saling tumpuk tipis spt tumpukan foto cetak. */}
      <PolaroidInset src={input.detailUrl1} width={230} height={288} rotateDeg={-7} top={130} left={44} />
      <PolaroidInset src={input.detailUrl2} width={230} height={288} rotateDeg={5} top={420} left={150} />
    </div>
  );

  return new ImageResponse(jsx, { width: WIDTH, height: HEIGHT, fonts });
}

export async function renderKolaseDetailPng(input: RenderKolaseDetailInput): Promise<Buffer> {
  const response = await renderKolaseDetailImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
