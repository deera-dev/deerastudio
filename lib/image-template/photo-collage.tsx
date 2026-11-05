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
// REVISI (November 2026, segera setelah itu — admin kirim referensi foto
// kolase kompetitor + 2 file SVG asset sendiri, "nah saya mau collasenya
// jadi seperti image 2 ... saya juga sudah siapkan assetnya"): ditambah 2
// elemen brand di atas foto — badge bundar ikon rusa hijau tua nempel di
// sambungan tengah 2 panel (menimpa sedikit foto kiri & kanan), dan
// wordmark "DEERA" putih transparan nempel di pojok kiri bawah
// (semula kanan bawah persis referensi, admin minta pindah ke kiri). Lihat
// loadBrandBadgeCircleDataUri/loadBrandWordmarkOverlayDataUri di assets.ts
// utk sumber asset-nya.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { loadFonts, loadBrandBadgeCircleDataUri, loadBrandWordmarkOverlayDataUri } from "./assets";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — konsisten dgn kolase lain di app ini (set-collage.tsx)

const BACKDROP = "#F7F2E9"; // krem hangat — sama dgn set-collage.tsx & color-lineup.tsx

export interface RenderPhotoCollageInput {
  leftUrl: string;
  rightUrl: string;
}

export async function renderPhotoCollageImageResponse(input: RenderPhotoCollageInput) {
  const [fonts, badgeUri, wordmarkUri] = await Promise.all([
    loadFonts(),
    loadBrandBadgeCircleDataUri(),
    loadBrandWordmarkOverlayDataUri(),
  ]);

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

  // Badge bundar: nempel pas di sambungan tengah, menimpa sedikit kedua
  // panel (bukan cuma pas di garis celah 6px). Wordmark: pojok kanan
  // bawah, nempel di atas panel kanan.
  const badgeSize = 92;
  const wordmarkWidth = 240;
  const wordmarkHeight = Math.round((wordmarkWidth * 280) / 796);
  const edgeMargin = 36;

  const jsx = (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        position: "relative",
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={badgeUri}
        alt=""
        width={badgeSize}
        height={badgeSize}
        style={{
          position: "absolute",
          top: HEIGHT / 2 - badgeSize / 2,
          left: WIDTH / 2 - badgeSize / 2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: "50%",
          boxShadow: "0 8px 20px -6px rgba(0,0,0,0.45)",
        }}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wordmarkUri}
        alt=""
        width={wordmarkWidth}
        height={wordmarkHeight}
        style={{
          position: "absolute",
          left: edgeMargin,
          bottom: edgeMargin,
          width: wordmarkWidth,
          height: wordmarkHeight,
        }}
      />
    </div>
  );

  return new ImageResponse(jsx, { width: WIDTH, height: HEIGHT, fonts });
}

export async function renderPhotoCollagePng(input: RenderPhotoCollageInput): Promise<Buffer> {
  const response = await renderPhotoCollageImageResponse(input);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
