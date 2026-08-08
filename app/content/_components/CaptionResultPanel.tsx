"use client";
// Hasil caption+hashtag yang sudah digenerate — bisa diedit manual sebelum
// disimpan sbg draft.
import { Button } from "@/components/ui/Button";
import { Label, Textarea } from "@/components/ui/Field";

export function CaptionResultPanel({
  caption,
  onCaptionChange,
  hashtags,
  onHashtagsChange,
  savingDraft,
  canSave,
  onSaveDraft,
}: {
  caption: string;
  onCaptionChange: (v: string) => void;
  hashtags: string;
  onHashtagsChange: (v: string) => void;
  savingDraft: boolean;
  canSave: boolean;
  onSaveDraft: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3">
      <div>
        <Label htmlFor="content-caption">Caption</Label>
        <Textarea id="content-caption" rows={6} value={caption} onChange={(e) => onCaptionChange(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="content-hashtags">Hashtag</Label>
        <Textarea id="content-hashtags" rows={2} value={hashtags} onChange={(e) => onHashtagsChange(e.target.value)} />
      </div>
      <Button type="button" variant="outline" loading={savingDraft} disabled={!canSave} onClick={onSaveDraft}>
        Simpan sebagai Draft
      </Button>
    </div>
  );
}
