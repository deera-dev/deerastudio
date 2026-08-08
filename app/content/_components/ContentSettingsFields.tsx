"use client";
// Format konten (feed/carousel/reel), tema, dan catatan tambahan admin.
import { Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import type { ContentPostTheme, ContentPostType } from "@/types/database";
import { CONTENT_TYPE_OPTIONS, THEME_OPTIONS } from "../_lib/types";

export function ContentSettingsFields({
  contentType,
  onContentTypeChange,
  theme,
  onThemeChange,
  extraNotes,
  onExtraNotesChange,
}: {
  contentType: ContentPostType;
  onContentTypeChange: (v: ContentPostType) => void;
  theme: ContentPostTheme;
  onThemeChange: (v: ContentPostTheme) => void;
  extraNotes: string;
  onExtraNotesChange: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="content-type">Format</Label>
          <Select
            id="content-type"
            value={contentType}
            onChange={(e) => onContentTypeChange(e.target.value as ContentPostType)}
          >
            {CONTENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="content-theme">Tema</Label>
          <Select id="content-theme" value={theme} onChange={(e) => onThemeChange(e.target.value as ContentPostTheme)}>
            {THEME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="content-notes">Catatan tambahan (opsional)</Label>
        <Textarea
          id="content-notes"
          rows={2}
          value={extraNotes}
          onChange={(e) => onExtraNotesChange(e.target.value)}
          placeholder='Info nyata yang boleh dipakai AI, mis. "promo 15% sampai 31 Agustus"'
        />
        <FieldHint>AI TIDAK akan mengarang diskon/testimoni/klaim apa pun di luar yang kamu tulis di sini.</FieldHint>
      </div>
    </>
  );
}
