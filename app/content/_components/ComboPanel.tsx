// DEPRECATED — file ini TIDAK dipakai lagi (digantikan useGroupCombo.ts +
// GroupComboPanel.tsx, yang generalisasi combo 2-produk ini ke 2-5 produk
// sekaligus). Dibiarkan ada, bukan dihapus, karena environment ini tidak
// mengizinkan hapus file setelah ditulis. Jangan import file ini di kode baru.
"use client";
// "Foto Gabungan Produk AI" — hanya tampil kalau PERSIS 2 produk terpilih.
// Gabungkan foto 2 produk jadi 1 frame baru (2 model tampil bersama).
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldHint, Textarea } from "@/components/ui/Field";
import type { ProductRow } from "../_lib/types";

export function ComboPanel({
  primaryProduct,
  secondaryProduct,
  comboSceneIdea,
  onSceneIdeaChange,
  generatingComboScene,
  onSuggestScene,
  generatingCombo,
  canGenerate,
  onGenerate,
}: {
  primaryProduct: ProductRow | null;
  secondaryProduct: ProductRow;
  comboSceneIdea: string;
  onSceneIdeaChange: (v: string) => void;
  generatingComboScene: boolean;
  onSuggestScene: () => void;
  generatingCombo: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border-strong bg-surface p-3.5">
      <div className="flex items-center gap-2 text-sm text-text">
        <Sparkles className="h-4 w-4 text-gold" />
        <span>
          Foto gabungan (opsional): <strong>{primaryProduct?.kode}</strong> +{" "}
          <strong>{secondaryProduct.kode}</strong>
        </span>
      </div>
      {!secondaryProduct.image ? (
        <FieldHint>Produk kedua ini belum punya foto utama, tidak bisa digabung.</FieldHint>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={generatingComboScene}
            onClick={onSuggestScene}
            className="self-start"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {comboSceneIdea.trim() ? "Sarankan Ulang" : "Sarankan Ide (AI)"}
          </Button>
          <Textarea
            rows={2}
            value={comboSceneIdea}
            onChange={(e) => onSceneIdeaChange(e.target.value)}
            placeholder="mis. two friends laughing together while walking through a sunlit garden path"
          />
          <FieldHint>
            Eksperimental: gabungkan 2 wajah + 2 baju lebih sulit buat AI dibanding restyle 1 foto —
            review hasilnya baik-baik, generate ulang kalau ada yang meleset. Hasilnya otomatis jadi foto
            utama post ini.
          </FieldHint>
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={generatingCombo}
            disabled={!canGenerate}
            onClick={onGenerate}
            className="self-start"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Foto Gabungan (AI)
          </Button>
        </>
      )}
    </div>
  );
}
