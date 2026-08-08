"use client";
// "Foto Marketing AI" — restyle scene/suasana dari foto produk yang SUDAH
// ADA (model & baju 100% sama, cuma suasana yang berubah), per-foto
// terpilih. Key-nya URL foto ASLI (bukan index) supaya regenerate
// berikutnya selalu mulai dari foto katalog asli, bukan hasil AI
// sebelumnya. `effectivePhotoUrl()` dipakai di seluruh page.tsx sbg pola
// tunggal "foto mana yang sebenarnya dipakai" (override AI kalau ada, else
// foto asli).
import { useState } from "react";
import { toast } from "sonner";
import type { ContentPostTheme } from "@/types/database";

type Override = { sceneIdea: string; url: string | null; generating: boolean; label?: string };

export function useMarketingPhotos(productKode: string | undefined, theme: ContentPostTheme, extraNotes: string) {
  const [sceneIdea, setSceneIdea] = useState("");
  const [marketingOverrides, setMarketingOverrides] = useState<Record<string, Override>>({});
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);

  function effectivePhotoUrl(url: string): string {
    return marketingOverrides[url]?.url || url;
  }

  function slotSceneIdea(url: string): string {
    return marketingOverrides[url]?.sceneIdea ?? sceneIdea;
  }

  function updateSlotSceneIdea(url: string, text: string) {
    setMarketingOverrides((prev) => ({
      ...prev,
      [url]: {
        sceneIdea: text,
        url: prev[url]?.url ?? null,
        generating: prev[url]?.generating ?? false,
        label: prev[url]?.label,
      },
    }));
  }

  function resetMarketingOverride(url: string) {
    setMarketingOverrides((prev) => {
      const next = { ...prev };
      delete next[url];
      return next;
    });
  }

  function resetAll() {
    setSceneIdea("");
    setMarketingOverrides({});
  }

  // Dipanggil sesudah "Sarankan Headline" (usePosterAi) sukses — pakai
  // sceneIdea baru dari AI sbg titik awal Foto Marketing AI, buang override
  // per-slide lama (headline baru = konteks scene yang beda).
  function applyHeadlineSceneIdea(text: string) {
    setSceneIdea(text);
    setMarketingOverrides({});
  }

  // "Generate Alur Cerita" — SATU pemanggilan AI sadar SEMUA slide sekaligus,
  // dirancang supaya tiap slide jadi beat cerita yang beda tapi tetap 1 alur
  // yang nyambung (bukan N foto random yang mirip).
  async function handleSuggestStoryboard(selectedPhotoUrls: string[]) {
    if (!productKode || selectedPhotoUrls.length < 2) return;
    setGeneratingStoryboard(true);
    try {
      const res = await fetch("/api/content/suggest-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode,
          theme,
          extraNotes: extraNotes || undefined,
          sceneCount: selectedPhotoUrls.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate alur cerita gagal");
      const scenes = data.scenes as { label: string; sceneIdea: string }[];
      setMarketingOverrides((prev) => {
        const next = { ...prev };
        selectedPhotoUrls.forEach((url, i) => {
          const scene = scenes[i];
          if (!scene) return;
          next[url] = { sceneIdea: scene.sceneIdea, url: next[url]?.url ?? null, generating: false, label: scene.label };
        });
        return next;
      });
      toast.success("Alur cerita siap — review arahan tiap foto lalu generate satu-satu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate alur cerita gagal");
    } finally {
      setGeneratingStoryboard(false);
    }
  }

  async function handleGenerateMarketingPhoto(sourceUrl: string) {
    const scene = slotSceneIdea(sourceUrl);
    if (!scene.trim()) return;
    setMarketingOverrides((prev) => ({
      ...prev,
      [sourceUrl]: { sceneIdea: scene, url: prev[sourceUrl]?.url ?? null, generating: true },
    }));
    try {
      const res = await fetch("/api/content/generate-marketing-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageUrl: sourceUrl, sceneDescription: scene }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate foto marketing gagal");
      setMarketingOverrides((prev) => ({ ...prev, [sourceUrl]: { sceneIdea: scene, url: data.url, generating: false } }));
      toast.success("Foto marketing baru siap dipakai");
    } catch (err) {
      setMarketingOverrides((prev) => ({
        ...prev,
        [sourceUrl]: { sceneIdea: scene, url: prev[sourceUrl]?.url ?? null, generating: false },
      }));
      toast.error(err instanceof Error ? err.message : "Generate foto marketing gagal");
    }
  }

  return {
    sceneIdea,
    marketingOverrides,
    generatingStoryboard,
    effectivePhotoUrl,
    slotSceneIdea,
    updateSlotSceneIdea,
    resetMarketingOverride,
    resetAll,
    applyHeadlineSceneIdea,
    handleSuggestStoryboard,
    handleGenerateMarketingPhoto,
  };
}
