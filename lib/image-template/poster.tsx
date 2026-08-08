// Render poster Instagram bergaya "designed content" (background foto produk
// + badge logo Deera + headline besar + subtitle + kode produk + swatch
// warna + caption bar opsional) — dipakai Content Studio (app/content).
// Engine: next/og ImageResponse (Satori). Font: fallback gratis (Fraunces,
// Alex Brush, Poppins) karena 3 font asli yang dikirim admin berlisensi
// Demo/Trial atau Personal-Use-Only (belum bisa dipakai komersial) — lihat
// keputusan admin di riwayat chat: "Pakai font gratis mirip dulu". Kalau
// nanti admin beli lisensi komersial font asli, cukup ganti file .ttf di
// lib/image-template/fonts/ + sesuaikan `name` di loadFonts(), tidak perlu
// ubah struktur render.
//
// Server-only (pakai node:fs) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { warnaToHex } from "./color-map";

const FONT_DIR = path.join(process.cwd(), "lib/image-template/fonts");
const ASSET_DIR = path.join(process.cwd(), "lib/image-template/assets");

type PosterFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 700;
  style: "normal";
};

let fontsCache: PosterFont[] | null = null;
let logoDataUriCache: string | null = null;

async function loadFonts(): Promise<PosterFont[]> {
  if (fontsCache) return fontsCache;
  const [frauncesSemi, frauncesBold, alexBrush, poppinsReg, poppinsSemi] = await Promise.all([
    readFile(path.join(FONT_DIR, "Fraunces-SemiBold.ttf")),
    readFile(path.join(FONT_DIR, "Fraunces-Bold.ttf")),
    readFile(path.join(FONT_DIR, "AlexBrush-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Poppins-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Poppins-SemiBold.ttf")),
  ]);
  fontsCache = [
    { name: "Fraunces", data: frauncesSemi, weight: 600, style: "normal" },
    { name: "Fraunces", data: frauncesBold, weight: 700, style: "normal" },
    { name: "AlexBrush", data: alexBrush, weight: 400, style: "normal" },
    { name: "Poppins", data: poppinsReg, weight: 400, style: "normal" },
    { name: "Poppins", data: poppinsSemi, weight: 600, style: "normal" },
  ];
  return fontsCache;
}

async function loadLogoDataUri(): Promise<string> {
  if (logoDataUriCache) return logoDataUriCache;
  const buf = await readFile(path.join(ASSET_DIR, "logo-mark.png"));
  logoDataUriCache = `data:image/png;base64,${buf.toString("base64")}`;
  return logoDataUriCache;
}

export interface PosterHeadlineLine {
  text: string;
  script?: boolean; // true = font aksen tulisan tangan (Alex Brush)
}

export interface PosterColorInput {
  warna: string;
}

export interface RenderPosterInput {
  photoUrl: string;
  headline: PosterHeadlineLine[]; // 1-3 baris
  subtitle?: string;
  productCode?: string;
  colors?: PosterColorInput[];
  bottomCaption?: string;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350; // 4:5 — rasio feed Instagram yang direkomendasikan

export async function renderPosterImageResponse(input: RenderPosterInput) {
  const [fonts, logoDataUri] = await Promise.all([loadFonts(), loadLogoDataUri()]);
  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const headline = input.headline.filter((l) => l.text.trim()).slice(0, 3);
  const bottomOffset = input.bottomCaption ? 210 : 96;

  const jsx = (
    <div
      style={{
        width,
        height,
        display: "flex",
        position: "relative",
        fontFamily: "Poppins",
        backgroundColor: "#0f0c08",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={input.photoUrl}
        alt=""
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }}
      />

      {/* gradasi gelap agar teks tetap terbaca di atas foto apa pun — mulai
          menggelap lebih awal (sekitar area headline) dan lebih pekat di
          bawah, supaya kontras tidak bergantung pada isi foto */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(to bottom, rgba(10,8,5,0.10) 0%, rgba(10,8,5,0) 22%, rgba(10,8,5,0.30) 40%, rgba(10,8,5,0.58) 56%, rgba(10,8,5,0.80) 74%, rgba(10,8,5,0.92) 100%)",
        }}
      />

      {/* logo Deera — kiri atas, file asli deera-white.png apa adanya (tanpa
          badge/card/shape di belakangnya, tanpa recolor) sesuai arahan
          admin. Bagian "lubang" rusa di file aslinya transparan — sengaja
          dibiarkan menampilkan foto di baliknya (efek "jendela"), bukan bug.
          Kalau nanti perlu diganti, tinggal timpa
          lib/image-template/assets/logo-mark.png dengan crop baru, tidak
          perlu proses recolor/fill-hole apa pun. */}
      <div style={{ position: "absolute", top: 40, left: 48, display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} alt="" width={130} height={183} style={{ display: "flex" }} />
      </div>

      {/* headline block — dibungkus panel semi-transparan (bukan cuma
          gradasi global) supaya tetap kebaca walau area foto di baliknya
          terang/ramai */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: bottomOffset,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignSelf: "flex-start",
            maxWidth: "100%",
            background: "rgba(8,6,4,0.46)",
            borderRadius: 18,
            padding: "26px 30px",
          }}
        >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {headline.map((line, i) => (
            <span
              key={i}
              style={{
                display: "flex",
                fontFamily: line.script ? "AlexBrush" : "Fraunces",
                fontWeight: line.script ? 400 : 700,
                fontSize: line.script ? 104 : 60,
                lineHeight: line.script ? 1 : 1.1,
                color: line.script ? "#C7AF6F" : "#FFFFFF",
                textShadow:
                  "0 1px 2px rgba(0,0,0,0.55), 0 8px 28px rgba(0,0,0,0.5)",
              }}
            >
              {line.text}
            </span>
          ))}
        </div>

        {input.subtitle ? (
          <span
            style={{
              display: "flex",
              fontFamily: "Poppins",
              fontWeight: 600,
              fontSize: 23,
              letterSpacing: 2,
              color: "#C7AF6F",
              marginTop: 16,
            }}
          >
            {input.subtitle}
          </span>
        ) : null}

        {input.productCode ? (
          <span
            style={{
              display: "flex",
              fontFamily: "Poppins",
              fontWeight: 400,
              fontSize: 19,
              color: "rgba(255,255,255,0.78)",
              marginTop: 10,
            }}
          >
            {`Product Code: ${input.productCode}`}
          </span>
        ) : null}

        {input.colors?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 22 }}>
            <span
              style={{
                display: "flex",
                fontFamily: "Poppins",
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: 3,
                color: "rgba(199,175,111,0.85)",
              }}
            >
              COLOUR AVAILABLE
            </span>
            <div style={{ display: "flex", flexDirection: "row", gap: 10 }}>
              {input.colors.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: warnaToHex(c.warna),
                    border: "2px solid rgba(255,255,255,0.9)",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </div>

      {/* caption bar bawah (opsional) */}
      {input.bottomCaption ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            padding: "28px 64px 36px",
            background: "linear-gradient(to top, rgba(8,6,4,0.94), rgba(8,6,4,0))",
          }}
        >
          <span
            style={{
              display: "flex",
              fontFamily: "Poppins",
              fontWeight: 400,
              fontSize: 19,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            {input.bottomCaption}
          </span>
        </div>
      ) : null}

    </div>
  );

  return new ImageResponse(jsx, { width, height, fonts });
}

export async function renderPosterPng(input: RenderPosterInput): Promise<Buffer> {
  const response = await renderPosterImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
