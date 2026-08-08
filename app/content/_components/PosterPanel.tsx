"use client";
// "Poster AI" — saran headline/subtitle/caption bawah dari AI, semua bisa
// diedit manual, lalu di-render jadi PNG poster (lib/image-template/poster.tsx).
// Menyisipkan <MarketingPhotoPanel/> di antara headline & subtitle (urutan
// alur asli: headline dulu, baru opsi restyle foto per-slide, baru sisanya).
import { ImageIcon, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { MarketingPhotoPanel } from "./MarketingPhotoPanel";

type HeadlineLine = { text: string; script: boolean };
type Slot = { sceneIdea: string; url: string | null; generating: boolean; label?: string } | undefined;

export function PosterPanel({
  isGroupContent,
  posterHeadline,
  suggestingHeadline,
  onSuggestHeadline,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
  sceneIdea,
  selectedPhotoUrls,
  marketingOverrides,
  slotSceneIdea,
  onSlotSceneIdeaChange,
  onGenerateSlot,
  onResetSlot,
  generatingStoryboard,
  onSuggestStoryboard,
  posterSubtitle,
  onSubtitleChange,
  showBottomCaption,
  onShowBottomCaptionChange,
  posterBottomCaption,
  onBottomCaptionChange,
  generatingBottomCaption,
  onRegenerateBottomCaption,
  showProductCode,
  onShowProductCodeChange,
  showColors,
  onShowColorsChange,
  posterColorsCount,
  renderingPoster,
  onRenderPoster,
  posterPreviewUrl,
  onUsePosterAsPhoto,
}: {
  isGroupContent: boolean;
  posterHeadline: HeadlineLine[];
  suggestingHeadline: boolean;
  onSuggestHeadline: () => void;
  onUpdateLine: (i: number, patch: Partial<HeadlineLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (i: number) => void;
  sceneIdea: string;
  selectedPhotoUrls: string[];
  marketingOverrides: Record<string, Slot>;
  slotSceneIdea: (url: string) => string;
  onSlotSceneIdeaChange: (url: string, text: string) => void;
  onGenerateSlot: (url: string) => void;
  onResetSlot: (url: string) => void;
  generatingStoryboard: boolean;
  onSuggestStoryboard: () => void;
  posterSubtitle: string;
  onSubtitleChange: (v: string) => void;
  showBottomCaption: boolean;
  onShowBottomCaptionChange: (v: boolean) => void;
  posterBottomCaption: string;
  onBottomCaptionChange: (v: string) => void;
  generatingBottomCaption: boolean;
  onRegenerateBottomCaption: () => void;
  showProductCode: boolean;
  onShowProductCodeChange: (v: boolean) => void;
  showColors: boolean;
  onShowColorsChange: (v: boolean) => void;
  posterColorsCount: number;
  renderingPoster: boolean;
  onRenderPoster: () => void;
  posterPreviewUrl: string | null;
  onUsePosterAsPhoto: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="!mb-0">Poster AI (opsional)</Label>
        <Button type="button" size="sm" variant="outline" loading={suggestingHeadline} onClick={onSuggestHeadline}>
          <Sparkles className="h-3.5 w-3.5" />
          {posterHeadline.length ? "Sarankan Ulang" : "Sarankan Headline"}
        </Button>
      </div>
      <p className="text-xs text-text-faint">
        AI menyarankan headline/mood untuk poster foto (bukan klaim produk).
        {!isGroupContent && " Kode produk & warna diambil otomatis dari data asli, bukan dari AI."}
      </p>

      {posterHeadline.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {posterHeadline.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={line.text}
                  onChange={(e) => onUpdateLine(i, { text: e.target.value })}
                  placeholder={`Baris ${i + 1}`}
                  className={cn(line.script && "italic")}
                />
                <button
                  type="button"
                  onClick={() => onUpdateLine(i, { script: !line.script })}
                  className={cn(
                    "shrink-0 rounded-md border px-2 py-2 text-[10px] font-medium uppercase tracking-wide",
                    line.script ? "border-gold text-gold-soft" : "border-border-strong text-text-faint"
                  )}
                  title="Toggle font aksen tulisan tangan"
                >
                  Script
                </button>
                <button type="button" onClick={() => onRemoveLine(i)} className="shrink-0 text-text-faint hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {posterHeadline.length < 3 && (
              <Button type="button" size="sm" variant="ghost" onClick={onAddLine}>
                + Tambah baris
              </Button>
            )}
          </div>

          {sceneIdea && selectedPhotoUrls.length > 0 && (
            <MarketingPhotoPanel
              selectedPhotoUrls={selectedPhotoUrls}
              marketingOverrides={marketingOverrides}
              slotSceneIdea={slotSceneIdea}
              onSlotSceneIdeaChange={onSlotSceneIdeaChange}
              onGenerateSlot={onGenerateSlot}
              onResetSlot={onResetSlot}
              generatingStoryboard={generatingStoryboard}
              onSuggestStoryboard={onSuggestStoryboard}
            />
          )}

          <div>
            <Label htmlFor="poster-subtitle">Subtitle</Label>
            <Input
              id="poster-subtitle"
              value={posterSubtitle}
              onChange={(e) => onSubtitleChange(e.target.value)}
              placeholder="mis. Aurora x Jasmine"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={showBottomCaption}
              onChange={(e) => onShowBottomCaptionChange(e.target.checked)}
            />
            Tampilkan caption bar bawah
          </label>
          {showBottomCaption && (
            <div className="flex flex-col gap-2">
              <Textarea
                rows={2}
                value={posterBottomCaption}
                onChange={(e) => onBottomCaptionChange(e.target.value)}
                placeholder="Kalimat penutup cerita, bukan tagline manfaat produk"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={generatingBottomCaption}
                onClick={onRegenerateBottomCaption}
                className="self-start"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Ulang Caption Bar
              </Button>
            </div>
          )}

          {!isGroupContent && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={showProductCode} onChange={(e) => onShowProductCodeChange(e.target.checked)} />
                Product code
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showColors}
                  disabled={posterColorsCount === 0}
                  onChange={(e) => onShowColorsChange(e.target.checked)}
                />
                Colour available {posterColorsCount > 0 ? `(${posterColorsCount})` : "(tidak ada data warna)"}
              </label>
            </div>
          )}
          {isGroupContent && (
            <p className="text-xs text-text-faint">
              Kode produk &amp; info warna disembunyikan di poster karena konten ini menampilkan lebih dari
              1 produk (mode grup).
            </p>
          )}

          <Button type="button" variant="outline" loading={renderingPoster} onClick={onRenderPoster}>
            <ImageIcon className="h-4 w-4" />
            {posterPreviewUrl ? "Render Ulang Preview" : "Render Preview"}
          </Button>

          {posterPreviewUrl && (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={posterPreviewUrl}
                alt="Preview poster"
                className="w-full max-w-[280px] self-center rounded-md border border-border-strong"
              />
              <Button type="button" size="sm" onClick={onUsePosterAsPhoto}>
                Pakai sebagai foto post
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
