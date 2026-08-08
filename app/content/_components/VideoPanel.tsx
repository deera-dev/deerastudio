"use client";
// Panel "Video Cerita Gabungan (AI)" Content Studio — muncul khusus saat
// contentType === "reel" (lihat page.tsx). REVISI Agustus 2026 v2 (admin
// minta SEMUA foto post digabung jadi 1 video utuh, bukan pilih 1 foto):
// admin toggle foto mana yang dipakai (urut = urutan klik), tiap foto
// dianimasikan jadi klip pendek, lalu SEMUA klip digabung jadi 1 video
// (lib/fal/video.ts). Video dilampirkan ke draft saat "Simpan Draft"
// ditekan (lihat useVideoGeneration + page.tsx).
import { Film, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { VideoClipJob } from "@/types/database";

export function VideoPanel({
  candidateUrls,
  composeUrls,
  onToggleCompose,
  videoPrompt,
  onVideoPromptChange,
  videoDuration,
  onVideoDurationChange,
  suggestingMotion,
  onSuggestMotion,
  submittingVideo,
  onGenerateVideo,
  videoStatus,
  videoUrl,
  errorMessage,
  clipJobs,
  elapsedSeconds,
}: {
  candidateUrls: string[];
  composeUrls: string[];
  onToggleCompose: (url: string) => void;
  videoPrompt: string;
  onVideoPromptChange: (text: string) => void;
  videoDuration: number;
  onVideoDurationChange: (n: number) => void;
  suggestingMotion: boolean;
  onSuggestMotion: () => void;
  submittingVideo: boolean;
  onGenerateVideo: () => void;
  videoStatus: "idle" | "processing" | "completed" | "failed";
  videoUrl: string | null;
  errorMessage: string | null;
  clipJobs: VideoClipJob[];
  elapsedSeconds: number;
}) {
  if (candidateUrls.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-3.5">
        <div className="flex items-center gap-2 text-sm text-text">
          <Film className="h-4 w-4 text-gold" />
          <span>Video Cerita Gabungan (AI)</span>
        </div>
        <FieldHint>Pilih/generate foto post dulu di atas sebelum bisa membuat video darinya.</FieldHint>
      </div>
    );
  }

  const doneClips = clipJobs.filter((j) => j.status === "completed").length;
  const stageLabel =
    clipJobs.length === 0
      ? "Memulai..."
      : doneClips < clipJobs.length
        ? `Generate klip ${doneClips}/${clipJobs.length}...`
        : "Menggabungkan video...";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-3.5">
      <div className="flex items-center gap-2 text-sm text-text">
        <Film className="h-4 w-4 text-gold" />
        <span>Video Cerita Gabungan (AI)</span>
      </div>
      <FieldHint>
        Tiap foto terpilih di bawah dianimasikan jadi klip pendek (gerakan halus, tanpa audio),
        lalu SEMUA klip digabung urut jadi 1 video utuh. Kling 3.0 Pro maks 15 detik per klip.
      </FieldHint>

      {videoStatus === "processing" && (
        <div className="flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold-soft">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {stageLabel} · {elapsedSeconds}s berjalan
        </div>
      )}

      {videoStatus === "failed" && errorMessage && (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
          Gagal: {errorMessage}
        </div>
      )}

      {videoStatus === "completed" && videoUrl && (
        <div className="overflow-hidden rounded-md border border-border">
          <video src={videoUrl} controls loop className="aspect-[3/4] w-full max-w-[220px] bg-black object-cover" />
        </div>
      )}

      <Label>Foto yang dipakai (urut sesuai klik)</Label>
      <div className="flex flex-wrap gap-2">
        {candidateUrls.map((url, i) => {
          const order = composeUrls.indexOf(url);
          return (
            <button
              key={url + i}
              type="button"
              onClick={() => onToggleCompose(url)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                order >= 0 ? "border-gold" : "border-border-strong hover:border-border"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              {order >= 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-ink">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-24">
          <Label htmlFor="cs-video-duration">Durasi/klip</Label>
          <Select
            id="cs-video-duration"
            value={videoDuration}
            onChange={(e) => onVideoDurationChange(Number(e.target.value))}
          >
            {[3, 5, 8, 10, 12, 15].map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[240px] flex-1">
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="cs-video-prompt" className="mb-0">
              Motion Prompt (Inggris)
            </Label>
            <button
              type="button"
              onClick={onSuggestMotion}
              disabled={suggestingMotion}
              className="flex items-center gap-1 text-xs font-medium text-gold hover:text-gold-soft disabled:opacity-50"
            >
              <Sparkles className={cn("h-3 w-3", suggestingMotion && "animate-pulse")} />
              Sarankan (AI)
            </button>
          </div>
          <Textarea
            id="cs-video-prompt"
            rows={2}
            value={videoPrompt}
            onChange={(e) => onVideoPromptChange(e.target.value)}
            placeholder="mis. Fabric sways gently in a soft breeze, slow camera push-in..."
          />
        </div>
        <Button
          type="button"
          size="sm"
          loading={submittingVideo || videoStatus === "processing"}
          disabled={composeUrls.length === 0 || !videoPrompt.trim()}
          onClick={onGenerateVideo}
        >
          <Film className="h-4 w-4" />
          {videoStatus === "completed" ? "Generate Ulang" : "Generate"}
        </Button>
      </div>
      <FieldHint>
        {composeUrls.length} foto dipilih · total ±{composeUrls.length * videoDuration} detik video
      </FieldHint>
    </div>
  );
}
