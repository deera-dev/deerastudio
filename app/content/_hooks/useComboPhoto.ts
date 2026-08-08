// DEPRECATED — file ini TIDAK dipakai lagi (digantikan useGroupCombo.ts +
// GroupComboPanel.tsx, yang generalisasi combo 2-produk ini ke 2-5 produk
// sekaligus). Dibiarkan ada, bukan dihapus, karena environment ini tidak
// mengizinkan hapus file setelah ditulis. Jangan import file ini di kode baru.
"use client";
// "Foto Gabungan Produk AI" — gabungkan foto 2 produk berbeda jadi SATU
// frame baru (2 model tampil bersama). Cuma aktif kalau PERSIS 2 produk
// terpilih (lihat secondaryProduct di useProductSelection) — teknis lebih
// dari 2 wajah dalam 1 frame terlalu sulit buat AI, jadi 3-5 produk masuk
// "mode grup" biasa (pool foto, bukan combo AI).
import { useState } from "react";
import { toast } from "sonner";
import type { ContentPostTheme } from "@/types/database";
import type { ProductRow } from "../_lib/types";

export function useComboPhoto(
  selectedProduct: ProductRow | null,
  secondaryProduct: ProductRow | null,
  theme: ContentPostTheme,
  extraNotes: string,
  effectivePhotoUrl: (url: string) => string,
  applyComboPhoto: (url: string) => void
) {
  const [comboSceneIdea, setComboSceneIdea] = useState("");
  const [generatingCombo, setGeneratingCombo] = useState(false);
  const [generatingComboScene, setGeneratingComboScene] = useState(false);
  // kepilih begitu foto gabungan berhasil digenerate & diterapkan — dipakai
  // saat simpan draft (secondaryProductKodes) & saat generate caption.
  const [comboSecondaryProduct, setComboSecondaryProduct] = useState<ProductRow | null>(null);

  function resetAll() {
    setComboSceneIdea("");
    setComboSecondaryProduct(null);
  }

  async function handleSuggestComboScene() {
    if (!selectedProduct || !secondaryProduct) return;
    setGeneratingComboScene(true);
    try {
      const res = await fetch("/api/content/suggest-combo-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKodeA: selectedProduct.kode,
          productKodeB: secondaryProduct.kode,
          theme,
          extraNotes: extraNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Sarankan ide gagal");
      setComboSceneIdea(data.sceneIdea);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sarankan ide gagal");
    } finally {
      setGeneratingComboScene(false);
    }
  }

  async function handleGenerateCombo(primaryUrl: string | undefined) {
    if (!primaryUrl || !secondaryProduct?.image || !comboSceneIdea.trim()) return;
    setGeneratingCombo(true);
    try {
      const res = await fetch("/api/content/generate-combo-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrlA: effectivePhotoUrl(primaryUrl),
          sourceImageUrlB: secondaryProduct.image,
          sceneDescription: comboSceneIdea,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate foto gabungan gagal");
      applyComboPhoto(data.url);
      setComboSecondaryProduct(secondaryProduct);
      toast.success(
        "Foto gabungan jadi foto utama — cek dulu sebelum dipakai, hasil AI 2-orang kadang perlu diulang."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate foto gabungan gagal");
    } finally {
      setGeneratingCombo(false);
    }
  }

  return {
    comboSceneIdea,
    setComboSceneIdea,
    generatingCombo,
    generatingComboScene,
    comboSecondaryProduct,
    resetAll,
    handleSuggestComboScene,
    handleGenerateCombo,
  };
}
