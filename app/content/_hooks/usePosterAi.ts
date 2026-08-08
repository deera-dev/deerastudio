"use client";
// Poster AI — headline/subtitle/bottomCaption/warna/kode dirender di atas
// foto lewat lib/image-template/poster.tsx (next/og). Saran awal via AI
// (suggest-headline), lalu semua bisa diedit manual sebelum di-render jadi
// PNG preview.
import { useState } from "react";
import { toast } from "sonner";
import type { ContentPostTheme } from "@/types/database";
import type { ProductRow } from "../_lib/types";

type HeadlineLine = { text: string; script: boolean };

export function usePosterAi(
  selectedProduct: ProductRow | null,
  theme: ContentPostTheme,
  extraNotes: string,
  onHeadlineSuggested: (sceneIdea: string) => void
) {
  const [posterHeadline, setPosterHeadline] = useState<HeadlineLine[]>([]);
  const [posterSubtitle, setPosterSubtitle] = useState("");
  const [posterBottomCaption, setPosterBottomCaption] = useState("");
  const [posterColors, setPosterColors] = useState<string[]>([]);
  const [posterProductCode, setPosterProductCode] = useState("");
  // Default OFF (biar poster fokus foto+headline, tidak terasa "jualan"
  // kayak flyer katalog) — admin nyalain manual kalau memang perlu.
  const [showProductCode, setShowProductCode] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showBottomCaption, setShowBottomCaption] = useState(false);
  const [suggestingHeadline, setSuggestingHeadline] = useState(false);
  const [generatingBottomCaption, setGeneratingBottomCaption] = useState(false);
  const [renderingPoster, setRenderingPoster] = useState(false);
  const [posterPreviewUrl, setPosterPreviewUrl] = useState<string | null>(null);

  function resetAll() {
    setPosterHeadline([]);
    setPosterSubtitle("");
    setPosterBottomCaption("");
    setPosterColors([]);
    setPosterProductCode("");
    setPosterPreviewUrl(null);
    setShowProductCode(false);
    setShowColors(false);
    setShowBottomCaption(false);
  }

  async function handleSuggestHeadline() {
    if (!selectedProduct) return;
    setSuggestingHeadline(true);
    try {
      const res = await fetch("/api/content/suggest-headline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKode: selectedProduct.kode, theme, extraNotes: extraNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Saran headline gagal");
      setPosterHeadline(
        (data.headline as { text: string; script?: boolean }[]).map((l) => ({ text: l.text, script: Boolean(l.script) }))
      );
      setPosterSubtitle(data.subtitle ?? "");
      setPosterBottomCaption(data.bottomCaption ?? "");
      setPosterColors((data.colors as string[]) ?? []);
      setPosterProductCode(data.productCode ?? selectedProduct.kode);
      setPosterPreviewUrl(null);
      onHeadlineSuggested(data.sceneIdea ?? "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saran headline gagal");
    } finally {
      setSuggestingHeadline(false);
    }
  }

  async function handleRegenerateBottomCaption() {
    if (!selectedProduct) return;
    setGeneratingBottomCaption(true);
    try {
      const headlineText = posterHeadline.map((l) => l.text).filter(Boolean).join(" — ");
      const res = await fetch("/api/content/suggest-bottom-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct.kode,
          theme,
          extraNotes: extraNotes || undefined,
          headlineText: headlineText || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Generate caption bar gagal");
      setPosterBottomCaption(data.bottomCaption);
      setPosterPreviewUrl(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate caption bar gagal");
    } finally {
      setGeneratingBottomCaption(false);
    }
  }

  function updatePosterLine(i: number, patch: Partial<HeadlineLine>) {
    setPosterHeadline((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    setPosterPreviewUrl(null);
  }

  function addPosterLine() {
    setPosterHeadline((prev) => (prev.length >= 3 ? prev : [...prev, { text: "", script: false }]));
  }

  function removePosterLine(i: number) {
    setPosterHeadline((prev) => prev.filter((_, idx) => idx !== i));
    setPosterPreviewUrl(null);
  }

  async function handleRenderPoster(photoUrl: string, productCodeFallback: string) {
    const headline = posterHeadline.filter((l) => l.text.trim());
    if (headline.length === 0) {
      toast.error("Isi minimal 1 baris headline dulu");
      return;
    }
    setRenderingPoster(true);
    try {
      const res = await fetch("/api/content/render-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl,
          headline,
          subtitle: posterSubtitle || undefined,
          productCode: posterProductCode || productCodeFallback,
          colors: posterColors,
          bottomCaption: posterBottomCaption || undefined,
          showProductCode,
          showColors,
          showBottomCaption,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.formErrors?.join(", ") || data?.error || "Render poster gagal");
      setPosterPreviewUrl(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render poster gagal");
    } finally {
      setRenderingPoster(false);
    }
  }

  return {
    posterHeadline,
    posterSubtitle,
    setPosterSubtitle,
    posterBottomCaption,
    setPosterBottomCaption,
    posterColors,
    posterProductCode,
    showProductCode,
    setShowProductCode,
    showColors,
    setShowColors,
    showBottomCaption,
    setShowBottomCaption,
    suggestingHeadline,
    generatingBottomCaption,
    renderingPoster,
    posterPreviewUrl,
    setPosterPreviewUrl,
    resetAll,
    handleSuggestHeadline,
    handleRegenerateBottomCaption,
    updatePosterLine,
    addPosterLine,
    removePosterLine,
    handleRenderPoster,
  };
}
