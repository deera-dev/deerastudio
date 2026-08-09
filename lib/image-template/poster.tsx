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
//
// REVISI Agustus 2026: loadFonts()/loadLogoDataUri() DIPINDAH ke
// lib/image-template/assets.ts (dipakai bareng set-collage.tsx — kolase
// "4 foto" Generate/History — supaya font & logo brand tidak dimuat/
// didefinisikan dua kali di dua template berbeda).
import { ImageResponse } from "next/og";
import { loadFonts, loadLogoDataUri } from "./assets";
import { warnaToHex } from "./color-map";

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

      {/* gradasi gelap tipis di seluruh bagian bawah foto — dasar kontras
          global, halus, tidak dominan */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "linear-gradient(to bottom, rgba(10,8,5,0.05) 0%, rgba(10,8,5,0) 30%, rgba(10,8,5,0.10) 50%, rgba(10,8,5,0.28) 68%, rgba(10,8,5,0.48) 84%, rgba(10,8,5,0.60) 100%)",
        }}
      />

      {/* vignette lembut menyatu ke foto (bukan kotak/panel keras) — pusatnya
          di kiri-bawah, tempat teks headline duduk, memudar melebar ke kanan
          & atas. Ini pengganti panel rgba solid+rounded sebelumnya, supaya
          kesan "sticker nempel di atas foto" hilang tapi kontras teks tetap
          terjaga di foto seramai/seterang apapun — kombinasi dgn textShadow
          berlapis di tiap elemen teks di bawah. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            "radial-gradient(120% 90% at 8% 100%, rgba(6,5,3,0.72) 0%, rgba(6,5,3,0.55) 28%, rgba(6,5,3,0.32) 48%, rgba(6,5,3,0.12) 68%, rgba(6,5,3,0) 85%)",
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

      {/* headline block — TANPA panel/card di belakangnya (dilepas sesuai
          arahan admin, kesan "kotak" bikin kurang premium). Kontras teks
          sekarang murni dari kombinasi vignette radial di atas + textShadow
          berlapis (tight dark outline + soft glow) di tiap elemen teks —
          teknik yang sama dipakai template Instagram premium lain supaya
          teks "melayang" alami di atas foto, bukan ditempel kotak. */}
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
                  "0 1px 3px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.75), 0 10px 32px rgba(0,0,0,0.55)",
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
              textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
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
              color: "rgba(255,255,255,0.85)",
              marginTop: 10,
              textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
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
                color: "rgba(199,175,111,0.9)",
                textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
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
              textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
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
