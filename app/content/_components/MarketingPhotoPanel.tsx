"use client";
// "Foto Marketing AI" — tiap foto terpilih bisa di-generate ULANG suasana/
// scene-nya sendiri-sendiri (model & baju tetap 100% sama). "Generate Alur
// Cerita" merancang SATU cerita nyambung utk semua slide sekaligus.
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Textarea, FieldHint } from "@/components/ui/Field";

type Slot = { sceneIdea: string; url: string | null; generating: boolean; label?: string } | undefined;

export function MarketingPhotoPanel({
  selectedPhotoUrls,
  marketingOverrides,
  slotSceneIdea,
  onSlotSceneIdeaChange,
  onGenerateSlot,
  onResetSlot,
  generatingStoryboard,
  onSuggestStoryboard,
}: {
  selectedPhotoUrls: string[];
  marketingOverrides: Record<string, Slot>;
  slotSceneIdea: (url: string) => string;
  onSlotSceneIdeaChange: (url: string, text: string) => void;
  onGenerateSlot: (url: string) => void;
  onResetSlot: (url: string) => void;
  generatingStoryboard: boolean;
  onSuggestStoryboard: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-strong bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="!mb-0">Foto Marketing AI (opsional)</Label>
        {selectedPhotoUrls.length > 1 && (
          <Button type="button" size="sm" variant="outline" loading={generatingStoryboard} onClick={onSuggestStoryboard}>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Alur Cerita
          </Button>
        )}
      </div>
      <FieldHint>
        Tiap foto yang kamu pilih di atas bisa di-generate ULANG suasana/scene-nya (model & baju tetap
        100% sama). Klik satu-satu kalau mau atur sendiri, atau klik &quot;Generate Alur Cerita&quot; supaya AI
        merancang SATU cerita yang nyambung utk semua slide sekaligus — baru review/edit arahannya
        sebelum generate tiap foto.
      </FieldHint>
      <div className="flex flex-col gap-3">
        {selectedPhotoUrls.map((url, i) => {
          const slot = marketingOverrides[url];
          const scene = slotSceneIdea(url);
          return (
            <div key={url} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row">
              <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slot?.url || url}
                  alt={`Foto ${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 rounded-md border border-border-strong object-cover"
                />
                <span className="text-center text-[10px] leading-tight text-text-faint">
                  {i === 0 ? "Foto 1 (bg poster)" : `Foto ${i + 1}`}
                  {slot?.label ? ` — ${slot.label}` : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <Textarea
                  rows={2}
                  value={scene}
                  onChange={(e) => onSlotSceneIdeaChange(url, e.target.value)}
                  placeholder="mis. warm minimalist living room, golden hour window light"
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={slot?.generating}
                    disabled={!scene.trim()}
                    onClick={() => onGenerateSlot(url)}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {slot?.url ? "Generate Ulang" : "Generate Foto Ini (AI)"}
                  </Button>
                  {slot?.url && (
                    <button type="button" onClick={() => onResetSlot(url)} className="text-xs text-text-faint hover:text-danger">
                      Pakai foto asli
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
