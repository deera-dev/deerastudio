"use client";
// Generate caption+hashtag Instagram dari produk terpilih, lalu simpan
// sbg draft ke content_posts. Mendukung "mode grup" (2-5 produk sekaligus,
// lihat useProductSelection.isGroupContent): caption tetap digenerate dari
// data produk PRIMER (produk pertama dipilih) supaya server-side tetap
// pakai 1 sumber fakta yang solid, tapi kita kirim additionalProductKodes
// supaya AI tahu ada produk lain yang JUGA tampil di konten ini tanpa
// menguraikan spesifikasinya (lihat app/api/content/generate-caption).
// `usedGroupPhoto` menandakan foto post ini dihasilkan dari "Foto Gabungan
// Grup" (lihat useGroupCombo) — SEMUA produk tampil BERSAMA di 1 frame,
// jadi caption boleh sebut "tampil bersama" secara natural.
import { useState } from "react";
import { toast } from "sonner";
import type { ContentPostTheme, ContentPostType } from "@/types/database";
import type { ProductRow } from "../_lib/types";

export function useCaptionGeneration(
  selectedProduct: ProductRow | null,
  theme: ContentPostTheme,
  contentType: ContentPostType,
  extraNotes: string,
  additionalProductKodes: string[],
  usedGroupPhoto: boolean,
  onSaved: () => void
) {
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [generatedHashtags, setGeneratedHashtags] = useState("");
  const [generating, setGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  function resetAll() {
    setGeneratedCaption("");
    setGeneratedHashtags("");
  }

  async function handleGenerateCaption() {
    if (!selectedProduct) return;
    setGenerating(true);
    try {
      // Kalau fotonya hasil "Foto Gabungan Grup" (semua model tampil
      // bersama di 1 frame), kasih tau AI lewat extraNotes yang DIKIRIM
      // (bukan textarea admin) supaya caption bisa nyebut kebersamaan itu
      // secara natural.
      const groupNote = usedGroupPhoto
        ? "Foto-foto di post ini menampilkan SEMUA produk tampil BERSAMA dalam satu frame yang sama (beberapa model difoto bersama). Boleh disebut caption secara natural (mis. \"bersama-sama\" / \"tampil berdampingan\"), tanpa menyebut kode/warna/bahan produk mana pun."
        : "";
      const combinedExtraNotes = [extraNotes.trim(), groupNote].filter(Boolean).join("\n\n");
      const res = await fetch("/api/content/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          theme,
          contentType,
          extraNotes: combinedExtraNotes || undefined,
          additionalProductKodes: additionalProductKodes.length ? additionalProductKodes : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate gagal");
      setGeneratedCaption(data.caption);
      setGeneratedHashtags((data.hashtags as string[]).join(" "));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate caption gagal");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft(imageUrls: string[], videoUrl?: string | null) {
    if (!selectedProduct || !generatedCaption || imageUrls.length === 0) return;
    setSavingDraft(true);
    try {
      const res = await fetch("/api/content-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          imageUrls,
          contentType,
          theme,
          caption: generatedCaption,
          hashtags: generatedHashtags.split(/\s+/).filter((h) => h.startsWith("#")),
          extraNotes: extraNotes || undefined,
          secondaryProductKodes: additionalProductKodes,
          videoUrl: videoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Simpan gagal");
      toast.success("Draft konten tersimpan");
      resetAll();
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Simpan draft gagal");
    } finally {
      setSavingDraft(false);
    }
  }

  return {
    generatedCaption,
    setGeneratedCaption,
    generatedHashtags,
    setGeneratedHashtags,
    generating,
    savingDraft,
    resetAll,
    handleGenerateCaption,
    handleSaveDraft,
  };
}
