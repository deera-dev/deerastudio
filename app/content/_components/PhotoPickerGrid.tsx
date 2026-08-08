"use client";
// Pilih 1 foto (feed/reel) atau 2-10 foto (carousel) dari opsi yang
// tersedia. Dalam mode grup, `options` sudah dikumpulkan dari SEMUA produk
// terpilih (lihat useProductSelection.photoOptions) dan labelnya dikasih
// prefix kode produk supaya admin tahu foto itu dari produk yang mana.
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/Field";
import type { ContentPostType } from "@/types/database";
import type { PhotoOption } from "../_lib/types";

export function PhotoPickerGrid({
  options,
  selectedUrls,
  contentType,
  onToggle,
}: {
  options: PhotoOption[];
  selectedUrls: string[];
  contentType: ContentPostType;
  onToggle: (url: string) => void;
}) {
  return (
    <div>
      <Label>Foto</Label>
      <p className="mb-2 text-xs text-text-faint">
        {contentType === "reel"
          ? "Pilih 1 foto (Reel pakai video, foto ini cuma cover)."
          : "Pilih 1 foto, atau 2-10 foto untuk Carousel (urutan klik = urutan slide) — Format otomatis berubah jadi Carousel begitu kamu pilih lebih dari 1."}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const idx = selectedUrls.indexOf(opt.url);
          const active = idx >= 0;
          return (
            <button
              key={opt.url}
              type="button"
              onClick={() => onToggle(opt.url)}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-md border-2 transition-colors",
                active ? "border-gold" : "border-border-strong hover:border-text-faint"
              )}
              title={opt.label}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.url}
                alt={opt.label}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              {active && contentType === "carousel" && (
                <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[10px] font-medium text-ink">
                  {idx + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
