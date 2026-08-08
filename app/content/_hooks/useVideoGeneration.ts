"use client";
// "Video Cerita Gabungan (AI)" Content Studio (Agustus 2026, REVISI v2 —
// admin minta SEMUA foto post digabung jadi 1 video utuh, bukan pilih 1
// foto). Tiap foto terpilih dari finalImageUrls (individual ATAU hasil
// Foto Gabungan Grup, tidak peduli sumbernya) dianimasikan jadi klip
// pendek via Kling (lib/fal/video.ts), lalu SEMUA klip digabung urut jadi
// 1 video via fal-ai/ffmpeg-api/merge-videos.
//
// STATELESS di server (beda dari History yang persist ke
// ai_generation_sets) — draft Content Studio belum tentu disimpan, jadi
// progress (clipJobs/mergeRequestId/videoStatus) hidup di state hook ini
// saja, hilang kalau admin pindah halaman SEBELUM draft disimpan (batasan
// yang wajar, sama seperti caption/poster yang juga belum persist sebelum
// "Simpan Draft"). videoUrl akhir dilampirkan ke draft lewat
// handleSaveDraft(imageUrls, videoUrl) di useCaptionGeneration.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ProductRow } from "../_lib/types";
import type { VideoClipJob } from "@/types/database";

export function useVideoGeneration(selectedProduct: ProductRow | null) {
  const [composeUrls, setComposeUrls] = useState<string[]>([]); // urut = urutan cerita
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState(5); // per-klip
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [clipJobs, setClipJobs] = useState<VideoClipJob[]>([]);
  const [mergeRequestId, setMergeRequestId] = useState<string | null>(null);
  const [suggestingMotion, setSuggestingMotion] = useState(false);
  const [submittingVideo, setSubmittingVideo] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Ref supaya effect polling (di bawah) cuma perlu depend on videoStatus —
  // tanpa ref, clipJobs/mergeRequestId berubah tiap poll akan restart
  // interval terus-menerus.
  const clipJobsRef = useRef(clipJobs);
  useEffect(() => {
    clipJobsRef.current = clipJobs;
  }, [clipJobs]);
  const mergeRequestIdRef = useRef(mergeRequestId);
  useEffect(() => {
    mergeRequestIdRef.current = mergeRequestId;
  }, [mergeRequestId]);

  function resetAll() {
    setComposeUrls([]);
    setVideoPrompt("");
    setVideoDuration(5);
    setVideoUrl(null);
    setVideoStatus("idle");
    setErrorMessage(null);
    setClipJobs([]);
    setMergeRequestId(null);
    setStartedAt(null);
  }

  // Dipanggil dari page.tsx tiap kali finalImageUrls berubah (foto baru
  // digenerate/dipilih) — default select SEMUA foto yang tersedia saat
  // ini, admin tinggal uncheck yang tidak mau dipakai.
  function initCandidates(urls: string[]) {
    setComposeUrls(urls);
  }

  function toggleComposeUrl(url: string) {
    setComposeUrls((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  async function handleSuggestMotion(contextNote?: string) {
    setSuggestingMotion(true);
    try {
      const res = await fetch("/api/generate-video-motion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productKode: selectedProduct?.kode,
          contextNote,
          durationSeconds: videoDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Gagal menyarankan motion prompt");
      setVideoPrompt(data.motionPrompt);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyarankan motion prompt");
    } finally {
      setSuggestingMotion(false);
    }
  }

  async function handleGenerateVideo() {
    if (composeUrls.length === 0 || !videoPrompt.trim()) return;
    setSubmittingVideo(true);
    setVideoStatus("processing");
    setErrorMessage(null);
    setVideoUrl(null);
    setMergeRequestId(null);
    setStartedAt(Date.now());
    setNowTick(Date.now());
    try {
      const res = await fetch("/api/content/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceImageUrls: composeUrls,
          prompt: videoPrompt.trim(),
          durationPerClipSeconds: videoDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generate video gagal");
      setClipJobs(data.clipJobs);
      toast.success(`Mulai generate ${composeUrls.length} klip video...`);
    } catch (err) {
      setVideoStatus("failed");
      setErrorMessage(err instanceof Error ? err.message : "Generate video gagal");
      toast.error(err instanceof Error ? err.message : "Generate video gagal");
    } finally {
      setSubmittingVideo(false);
    }
  }

  // Polling — jalan HANYA saat videoStatus === "processing". State
  // (clipJobs/mergeRequestId) dikirim balik ke server tiap poll supaya
  // server tetap stateless (lihat catatan file ini di atas).
  useEffect(() => {
    if (videoStatus !== "processing") return;
    let cancelled = false;
    const tick = setInterval(() => setNowTick(Date.now()), 1000);
    const poll = setInterval(async () => {
      if (clipJobsRef.current.length === 0) return;
      const res = await fetch("/api/content/generate-video/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipJobs: clipJobsRef.current,
          mergeRequestId: mergeRequestIdRef.current,
        }),
      });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (cancelled) return;
      setClipJobs(data.clipJobs);
      setMergeRequestId(data.mergeRequestId);
      setVideoStatus(data.videoStatus);
      setVideoUrl(data.videoUrl);
      setErrorMessage(data.errorMessage);
      if (data.videoStatus === "completed") toast.success("Video cerita gabungan selesai!");
      if (data.videoStatus === "failed") toast.error(data.errorMessage || "Generate video gagal");
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [videoStatus]);

  return {
    composeUrls,
    initCandidates,
    toggleComposeUrl,
    videoPrompt,
    setVideoPrompt,
    videoDuration,
    setVideoDuration,
    videoUrl,
    videoStatus,
    errorMessage,
    clipJobs,
    suggestingMotion,
    submittingVideo,
    elapsedSeconds: startedAt ? Math.max(0, Math.floor((nowTick - startedAt) / 1000)) : 0,
    resetAll,
    handleSuggestMotion,
    handleGenerateVideo,
  };
}
