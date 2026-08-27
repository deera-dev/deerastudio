// Kolase "Lineup Warna" (Agustus 2026, REVISI BESAR — lihat header lengkap
// di lib/prompts/color-lineup-generate.ts): dulu versi PERTAMA fitur ini
// murni menyusun grid dari foto flat-lay ASLI (TANPA AI). Setelah admin
// kirim referensi foto "colorway lineup" editorial (garment digantung rapi
// di hanger rail / fanned overlapping, styling studio premium) dan minta
// versi lebih bagus, fitur PIVOT ke AI generation (runColorLineupGenerate)
// — 1 foto hero yang menampilkan SEMUA warna bersama dalam 1 scene.
//
// Template di file ini SEKARANG cuma bertugas nempelin CAPTION nama-nama
// warna di bawah foto hero AI itu (BUKAN lagi grid N panel foto terpisah)
// — teks label sengaja TIDAK diminta dirender oleh AI (model image-gen
// tidak reliable render teks bersih), jadi ditempel di sini via next/og yang
// hasilnya selalu tajam/rapi.
//
// Server-only (next/og ImageResponse) — jangan diimpor dari komponen client.
import { ImageResponse } from "next/og";
import { loadFonts } from "./assets";

const WIDTH = 1080;
const CAPTION_HEIGHT = 130;
const HEIGHT = WIDTH + CAPTION_HEIGHT; // foto hero AI persegi (aspect_ratio "1:1")

const BACKDROP = "#F7F2E9"; // krem hangat — sama dgn set-collage.tsx
const INK = "#1F2A1C"; // hijau tua gelap — teks

export interface RenderColorLineupInput {
  heroImageUrl: string; // hasil runColorLineupGenerate (foto AI, semua warna dlm 1 scene)
  productKode: string;
  colorLabels: string[]; // urut sesuai urutan tampil di scene, dipisah "·" di caption
}

export async function renderColorLineupImageResponse(input: RenderColorLineupInput) {
  const fonts = await loadFonts();

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
      <div style={{ display: "flex", width: WIDTH, height: WIDTH, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={input.heroImageUrl}
          alt=""
          width={WIDTH}
          height={WIDTH}
          style={{ width: WIDTH, height: WIDTH, objectFit: "cover" }}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: WIDTH,
          height: CAPTION_HEIGHT,
        }}
      >
        <span
          style={{
            display: "flex",
            fontFamily: "Poppins",
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: 1,
            color: INK,
          }}
        >
          {input.colorLabels.join("   ·   ")}
        </span>
        <span
          style={{
            display: "flex",
            marginTop: 8,
            fontFamily: "Poppins",
            fontWeight: 400,
            fontSize: 13,
            letterSpacing: 2,
            color: "#8A8272",
            textTransform: "uppercase",
          }}
        >
          {input.productKode}
        </span>
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
