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
// REVISI (November 2026, segera setelah rilis — admin: "bagian kolasenya
// juga full aja / gap minim, sekarang terlalu banyak space, jadi bisa
// maksimalin fotonya"): margin atas/bawah/samping yang tadinya 56-64px
// DIHAPUS total — tiap panel sekarang full-bleed sampai ke tepi kanvas,
// cuma sisa celah 6px antar 2 panel biar tetap kebedain.
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

  // Admin: "bagian kolasenya juga full aja / gap minim, sekarang terlalu
  // banyak space, jadi bisa maksimalin fotonya" — margin dihapus total,
  // cuma sisa celah tipis antar panel (bukan 0, biar 2 foto tetap
  // kebedain, tidak nyatu jadi 1).
  const gapBetween = 6;
  const panelHeight = HEIGHT;
  const panelWidth = (WIDTH - gapBetween) / 2;

  const panelStyle = {
    display: "flex",
    overflow: "hidden",
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
