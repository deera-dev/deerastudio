"use client";
// Panel utama mode grup — ganti alur "pilih foto individual per produk"
// lama. Admin tentukan berapa foto cerita (sceneCount), lalu tiap scene
// digabungkan jadi 1 frame berisi SEMUA model/produk terpilih tampil
// bersama (lib/prompts/combo-photo.ts).
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import type { GroupScene } from "../_hooks/useGroupCombo";

export function GroupComboPanel({
  productCount,
  readySourceCount,
  sceneCount,
  onSceneCountChange,
  scenes,
  onSceneIdeaChange,
  generatingStory,
  onSuggestStory,
  onGenerateScene,
}: {
  productCount: number;
  readySourceCount: number;
  sceneCount: number;
  onSceneCountChange: (n: number) => void;
  scenes: GroupScene[];
  onSceneIdeaChange: (index: number, text: string) => void;
  generatingStory: boolean;
  onSuggestStory: () => void;
  onGenerateScene: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-3.5">
      <div className="flex items-center gap-2 text-sm text-text">
        <Sparkles className="h-4 w-4 text-gold" />
        <span>Foto Gabungan Grup (AI) — {productCount} model tampil bersama di tiap frame</span>
      </div>

      {readySourceCount < 2 ? (
        <FieldHint>
          Minimal 2 dari produk terpilih perlu punya foto utama supaya bisa digabung — saat ini baru{" "}
          {readySourceCount} yang punya foto.
        </FieldHint>
      ) : (
        <>
          <FieldHint>
            Eksperimental: menggabungkan {productCount} wajah + {productCount} baju dalam 1 frame jauh lebih
            sulit buat AI dibanding restyle 1 foto — review tiap hasil baik-baik, generate ulang kalau ada
            yang meleset. Foto-foto ini otomatis jadi foto post (urutan scene = urutan slide carousel).
          </FieldHint>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Label htmlFor="group-scene-count">Jumlah foto cerita</Label>
              <Select id="group-scene-count" value={sceneCount} onChange={(e) => onSceneCountChange(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} foto
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" size="sm" variant="outline" loading={generatingStory} onClick={onSuggestStory}>
              <Sparkles className="h-3.5 w-3.5" />
              Sarankan Alur Cerita (AI)
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {scenes.map((scene, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2.5 sm:flex-row">
                <div className="flex shrink-0 flex-row items-center gap-2 sm:w-16 sm:flex-col">
                  {scene.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={scene.url}
                      alt={`Scene ${i + 1}`}
                      className="h-16 w-16 rounded-md border border-border-strong object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-border-strong text-[10px] text-text-faint">
                      Scene {i + 1}
                    </div>
                  )}
                  {scene.label && (
                    <span className="text-center text-[10px] leading-tight text-text-faint">{scene.label}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <Textarea
                    rows={2}
                    value={scene.sceneIdea}
                    onChange={(e) => onSceneIdeaChange(i, e.target.value)}
                    placeholder="mis. a group of friends laughing together while walking through a sunlit garden path"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={scene.generating}
                    disabled={!scene.sceneIdea.trim()}
                    onClick={() => onGenerateScene(i)}
                    className="self-start"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {scene.url ? "Generate Ulang" : "Generate Foto Ini (AI)"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
