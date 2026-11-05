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
// elemen brand terpisah — badge bundar ikon rusa hijau tua di sambungan
// tengah, dan wordmark "DEERA" transparan di pojok bawah. Lalu DIGANTI
// TOTAL (segera setelah itu, admin kirim referensi + SVG baru: "ubah lagi
// ya seperti image pertama aja ... garis tengahnya pake background color
// hex diatas") jadi 1 badge melengkung gabungan (ikon rusa + wordmark
// "DEERA" jadi satu bentuk) nempel di tepi atas-tengah, menggantung
// menimpa kedua panel — lihat loadBrandTopBadgeDataUri di assets.ts. Garis
// celah 6px antar panel juga diganti warnanya jadi hijau tua (SEAM_COLOR,
// sama dgn warna badge) alih-alih krem.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { loadFonts, loadBrandTopBadgeDataUri } from "./assets";

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5 — konsisten dgn kolase lain di app ini (set-collage.tsx)

// Hijau tua — warna badge atas (brand-top-badge.png, #2E412D persis dari
// SVG asal yang dikirim admin), dipakai juga sbg warna garis celah tengah
// antar 2 panel foto ("garis tengahnya pake background color hex diatas").
const SEAM_COLOR = "#2E412D";

export interface RenderPhotoCollageInput {
  leftUrl: string;
  rightUrl: string;
}

export async function renderPhotoCollageImageResponse(input: RenderPhotoCollageInput) {
  const [fonts, topBadgeUri] = await Promise.all([loadFonts(), loadBrandTopBadgeDataUri()]);

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

  // Badge atas: nempel rata di tepi atas (top: 0), rata tengah horizontal,
  // menggantung menimpa sedikit kedua panel — proporsi sama dgn asset asli
  // (242:97).
  const topBadgeWidth = 340;
  const topBadgeHeight = Math.round((topBadgeWidth * 97) / 242);

  const jsx = (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: "flex",
        position: "relative",
        fontFamily: "Poppins",
        backgroundColor: SEAM_COLOR,
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
        src={topBadgeUri}
        alt=""
        width={topBadgeWidth}
        height={topBadgeHeight}
        style={{
          position: "absolute",
          top: 0,
          left: WIDTH / 2 - topBadgeWidth / 2,
          width: topBadgeWidth,
          height: topBadgeHeight,
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
