// Kolase 2-Foto PILIHAN BEBAS (November 2026) — admin: "saya mau nambah
// fitur collase atau foto grid dimana bisa bikin 2 foto bergabung jadi 1,
// rencananya seperti menggabungkan foto tampak depan dan tampak belakang
// buat di share ke langganan, atau foto tampak depan dengan foto seri
// warna lengkap".
//
// BEDA dari renderKolaseGabunganPng (set-collage.tsx): itu SELALU potret
// (kiri, dicrop condong ke atas) + badan-penuh (kanan), dgn sumber foto
// FIXED (utama+angle, dipanggil otomatis saat generate-set). Di sini admin
// BEBAS pilih 2 foto apa saja dari riwayat produk itu (History ->
// "+ Kolase 2 Foto") — jadi kedua panel diberi porsi SAMA (50/50), tidak
// ada asumsi salah satu foto harus full-body/potret.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { loadFonts } from "./assets";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — konsisten dgn kolase lain di app ini (set-collage.tsx)

const BACKDROP = "#F7F2E9"; // krem hangat — sama dgn set-collage.tsx & color-lineup.tsx

export interface RenderPhotoCollageInput {
  leftUrl: string;
  rightUrl: string;
}

export async function renderPhotoCollageImageResponse(input: RenderPhotoCollageInput) {
  const fonts = await loadFonts();

  const topMargin = 56;
  const panelBottom = 64;
  const sideMargin = 56;
  const gapBetween = 14;
  const panelHeight = HEIGHT - topMargin - panelBottom;
  const panelWidth = (WIDTH - sideMargin * 2 - gapBetween) / 2;

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
        <div style={{ ...panelStyle, width: panelWidth, height: panelHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={input.leftUrl}
            alt=""
            width={panelWidth}
            height={panelHeight}
            style={{
              width: panelWidth,
              height: panelHeight,
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        </div>
        <div style={{ ...panelStyle, width: panelWidth, height: panelHeight }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={input.rightUrl}
            alt=""
            width={panelWidth}
            height={panelHeight}
            style={{
              width: panelWidth,
              height: panelHeight,
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

export async function renderPhotoCollagePng(input: RenderPhotoCollageInput): Promise<Buffer> {
  const response = await renderPhotoCollageImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
