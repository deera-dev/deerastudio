// Kolase "Lineup Warna" (Agustus 2026) — admin: "tambahin 1 lagi ya untuk
// serian warna, saya mau masukin jadi 1 foto aja digantung dengan hanger
// tanpa merubah detail sedikit pun, nantinya 1 produk tersebut akan
// bersandingan dengan produk yang sama, hanya serian warnanya saja yang
// berbeda". Tujuannya: 1 gambar yang menampilkan SEMUA warna varian produk
// yang sama, bersisian, supaya pembeli/tim marketing bisa bandingkan warna
// dalam 1 lihat.
//
// PENTING (BEDA dari role "seri" yang sudah ada) — BUKAN panggilan AI sama
// sekali. "tanpa merubah detail sedikit pun" cuma bisa dijamin 100% kalau
// tidak ada AI yang menyentuh gambarnya — jadi template ini murni MENYUSUN
// ULANG foto ASLI yang sudah diupload admin utk tiap warna (product_images
// warna utama + variant_product_images.image tiap baris "seri", BUKAN
// output_image_url hasil generate AI role "seri") jadi 1 gambar lewat
// next/og (Satori), pola yang SAMA dgn set-collage.tsx (kolase gabungan/
// detail) & poster.tsx (Poster AI Content Studio). Cost 0 (tidak ada
// panggilan fal.ai). Lihat app/api/generation-sets/[id]/color-lineup/
// route.ts utk cara entries-nya dikumpulkan.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { loadFonts } from "./assets";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — konsisten dgn poster.tsx & set-collage.tsx

const BACKDROP = "#F7F2E9"; // krem hangat — sama dgn set-collage.tsx
const INK = "#1F2A1C"; // hijau tua gelap — teks judul/label

export interface ColorLineupEntry {
  url: string; // foto ASLI yang diupload admin (flat-lay/full-body) — TIDAK diubah/diproses AI sama sekali
  label: string; // nama warna, mis. "MERAH", atau "Utama" kalau warna utama tidak punya nama tersimpan
}

export interface RenderColorLineupInput {
  productKode: string;
  entries: ColorLineupEntry[]; // 2-7 entri (warna utama + sampai 6 seri, lihat requestSchema di route.ts)
}

function ColorPanel({
  entry,
  width,
  height,
}: {
  entry: ColorLineupEntry;
  width: number;
  height: number;
}) {
  const labelHeight = 44;
  const imageHeight = height - labelHeight;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        borderRadius: 6,
        overflow: "hidden",
        backgroundColor: "#FFFFFF",
        boxShadow: "0 14px 30px -10px rgba(31,42,28,0.3)",
      }}
    >
      <div style={{ display: "flex", width, height: imageHeight, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.url}
          alt=""
          width={width}
          height={imageHeight}
          style={{ width, height: imageHeight, objectFit: "cover", objectPosition: "top center" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width,
          height: labelHeight,
          borderTop: `1px solid #EAE2D2`,
        }}
      >
        <span
          style={{
            fontFamily: "Poppins",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: 2,
            color: INK,
            textTransform: "uppercase",
          }}
        >
          {entry.label}
        </span>
      </div>
    </div>
  );
}

export async function renderColorLineupImageResponse(input: RenderColorLineupInput) {
  const fonts = await loadFonts();

  const sideMargin = 56;
  const topMargin = 90;
  const bottomMargin = 56;
  const gap = 20;
  const count = input.entries.length;
  // Maks 4 kolom per baris — 5-7 warna otomatis wrap ke baris ke-2 (flexWrap
  // di bawah), rapi dgn justifyContent "center" supaya baris terakhir yang
  // tidak penuh tetap center, bukan nge-gantung rata kiri.
  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);

  const gridWidth = WIDTH - sideMargin * 2;
  const gridHeight = HEIGHT - topMargin - bottomMargin;
  const panelWidth = (gridWidth - gap * (cols - 1)) / cols;
  const panelHeight = (gridHeight - gap * (rows - 1)) / rows;

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
          flexDirection: "column",
          alignItems: "center",
          marginTop: 40,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: "Poppins",
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: 6,
            color: INK,
            textTransform: "uppercase",
          }}
        >
          Pilihan Warna
        </span>
        <span
          style={{
            display: "flex",
            marginTop: 6,
            fontFamily: "Poppins",
            fontWeight: 400,
            fontSize: 13,
            letterSpacing: 2,
            color: "#8A8272",
          }}
        >
          {input.productKode}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignContent: "center",
          width: gridWidth,
          height: gridHeight,
          gap,
        }}
      >
        {input.entries.map((entry, i) => (
          <ColorPanel key={i} entry={entry} width={panelWidth} height={panelHeight} />
        ))}
      </div>
    </div>
  );

  return new ImageResponse(jsx, { width: WIDTH, height: HEIGHT, fonts });
}

export async function renderColorLineupPng(input: RenderColorLineupInput): Promise<Buffer> {
  const response = await renderColorLineupImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
