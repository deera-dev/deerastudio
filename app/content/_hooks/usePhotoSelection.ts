"use client";
// Pilihan foto (1 utk feed/reel, 2-10 utk carousel) + Format konten. Foto
// picker SELALU multi-select: tiap klik menambah/menghapus dari daftar
// (kecuali "reel" yg tetap 1 foto krn pakai video), Format otomatis
// kepromosikan ke Carousel begitu 2+ foto terpilih.
import { useEffect, useState } from "react";
import type { ContentPostType } from "@/types/database";

export function usePhotoSelection() {
  const [selectedPhotoUrls, setSelectedPhotoUrls] = useState<string[]>([]);
  const [contentType, setContentType] = useState<ContentPostType>("feed_single");

  useEffect(() => {
    if (selectedPhotoUrls.length > 1 && contentType === "feed_single") {
      setContentType("carousel");
    }
  }, [selectedPhotoUrls.length, contentType]);

  function togglePhoto(url: string) {
    if (contentType === "reel") {
      setSelectedPhotoUrls([url]);
      return;
    }
    setSelectedPhotoUrls((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      if (prev.length >= 10) return prev;
      return [...prev, url];
    });
  }

  function setContentTypeChecked(v: ContentPostType) {
    setContentType(v);
    if (v !== "carousel") setSelectedPhotoUrls((prev) => prev.slice(0, 1));
  }

  return { selectedPhotoUrls, setSelectedPhotoUrls, contentType, togglePhoto, setContentTypeChecked };
}
