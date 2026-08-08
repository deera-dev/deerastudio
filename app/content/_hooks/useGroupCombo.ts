"use client";
// "Foto Gabungan Grup" — mode grup (2-5 produk terpilih sekaligus, lihat
// useProductSelection.isGroupContent). Beda dari alur single-produk lama:
// di sini TIDAK ada pilih-foto-individual-per-produk — admin langsung
// tentukan berapa foto cerita (sceneCount) yang mau digenerate, tiap foto
// = SATU frame baru berisi SEMUA model/produk terpilih tampil bersama
// (lib/prompts/combo-photo.ts, digabung dari foto utama tiap produk).
import { useState } from "react";
import { toast } from "sonner";
import type { ContentPostTheme } from "@/types/database";
import type { ProductRow } from "../_lib/types";

export type GroupScene = { sceneIdea: string; url: string | null; generating: boolean; label?: string };

const DEFAULT_SCENE_COUNT = 3;

function emptyScenes(n: number): GroupScene[] {
  return Array.from({ length: n }, () => ({ sceneIdea: "", url: null, generating: false }));
}

export function useGroupCombo(selectedProducts: ProductRow[], theme: ContentPostTheme, extraNotes: string) {
  const [sceneCount, setSceneCount] = useState(DEFAULT_SCENE_COUNT);
  const [scenes, setScenes] = useState<GroupScene[]>(emptyScenes(DEFAULT_SCENE_COUNT));
  const [generatingStory, setGeneratingStory] = useState(false);

  function resetAll() {
    setSceneCount(DEFAULT_SCENE_COUNT);
    setScenes(emptyScenes(DEFAULT_SCENE_COUNT));
  }

  function changeSceneCount(n: number) {
    setSceneCount(n);
    setScenes((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push({ sceneIdea: "", url: null, generating: false });
      return next;
    });
  }

  function updateSceneIdea(index: number, text: string) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, sceneIdea: text } : s)));
  }

  // Dipakai "Pakai sebagai foto post" di Poster AI — timpa hasil scene
  // index tsb dgn PNG poster yang sudah dirender.
  function overrideSceneUrl(index: number, url: string) {
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, url } : s)));
  }

  async function handleSuggestStory() {
    if (selectedProducts.length < 2) return;
    setGeneratingStory(true);
    try {
      const res = await fetch("/api/content/suggest-group-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKodes: selectedProducts.map((p) => p.kode),
          theme,
          extraNotes: extraNotes.trim() || undefined,
          sceneCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Sarankan alur cerita gagal");
      const result = data.scenes as { label: string; sceneIdea: string }[];
      setScenes((prev) =>
        Array.from({ length: sceneCount }, (_, i) => ({
          sceneIdea: result[i]?.sceneIdea ?? prev[i]?.sceneIdea ?? "",
          url: prev[i]?.url ?? null,
          generating: false,
          label: result[i]?.label,
        }))
      );
      toast.success("Alur cerita grup siap — review arahan tiap scene lalu generate satu-satu");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sarankan alur cerita gagal");
    } finally {
      setGeneratingStory(false);
    }
  }

  async function handleGenerateScene(index: number) {
    const scene = scenes[index];
    if (!scene?.sceneIdea.trim()) return;
    const sourceImageUrls = selectedProducts.map((p) => p.image).filter((u): u is string => Boolean(u));
    if (sourceImageUrls.length < 2) {
      toast.error("Minimal 2 produk yang punya foto utama dibutuhkan untuk foto gabungan");
      return;
    }
    setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, generating: true } : s)));
    try {
      const res = await fetch("/api/content/generate-combo-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceImageUrls, sceneDescription: scene.sceneIdea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate foto gabungan gagal");
      setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, url: data.url, generating: false } : s)));
      toast.success(`Scene ${index + 1} berhasil digenerate — review dulu sebelum dipakai.`);
    } catch (err) {
      setScenes((prev) => prev.map((s, i) => (i === index ? { ...s, generating: false } : s)));
      toast.error(err instanceof Error ? err.message : "Generate foto gabungan gagal");
    }
  }

  const resultUrls = scenes.map((s) => s.url).filter((u): u is string => Boolean(u));
  const readySourceCount = selectedProducts.filter((p) => p.image).length;

  return {
    sceneCount,
    changeSceneCount,
    scenes,
    updateSceneIdea,
    overrideSceneUrl,
    generatingStory,
    handleSuggestStory,
    handleGenerateScene,
    resultUrls,
    readySourceCount,
    resetAll,
  };
}
