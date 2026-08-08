"use client";
// Muncul begitu 2+ produk terpilih — jelaskan bahwa konten ini "mode grup"
// (brand awareness lintas produk), bukan highlight 1 produk, jadi kode/
// warna/bahan sengaja TIDAK ditampilkan/dipakai di caption maupun poster.
// Chip nama produk bisa dilepas langsung dari sini.
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ProductRow } from "../_lib/types";

export function GroupContentNotice({
  products,
  onRemove,
}: {
  products: ProductRow[];
  onRemove: (kode: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-gold/30 bg-gold/5 p-3.5">
      <div className="flex items-center gap-2">
        <Badge tone="gold">Mode Grup</Badge>
        <span className="text-sm text-text">
          {products.length} produk tampil bersama dalam 1 konten brand awareness.
        </span>
      </div>
      <p className="text-xs leading-relaxed text-text-muted">
        Karena lebih dari 1 produk terpilih, caption &amp; poster TIDAK akan menyebut kode, warna, atau
        bahan produk mana pun — fokusnya murni cerita/momen bersama, bukan spesifikasi barang.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {products.map((p, i) => (
          <span
            key={p.kode}
            className="flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-xs text-text"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-semibold text-ink">
              {i + 1}
            </span>
            {p.nama}
            <button
              type="button"
              onClick={() => onRemove(p.kode)}
              className="text-text-faint hover:text-danger"
              title="Lepas produk ini"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
