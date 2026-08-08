"use client";
// Kartu 1a — cari & pilih produk (1-5 sekaligus). Grid desktop sengaja
// lebih lebar & thumbnail lebih besar (permintaan admin: "kelihatan lebih
// banyak, jangan kekecilan") — 4 kolom x ~5 baris kelihatan tanpa scroll di
// desktop, scroll cuma muncul kalau hasil pencarian lebih panjang dari itu.
import { Check, ImageIcon, Search } from "lucide-react";
import { Input, Label, FieldHint } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { MAX_SELECTED_PRODUCTS, type ProductRow } from "../_lib/types";

export function ProductPicker({
  productQuery,
  onQueryChange,
  productResults,
  loadingProducts,
  selectedProducts,
  onSelect,
}: {
  productQuery: string;
  onQueryChange: (v: string) => void;
  productResults: ProductRow[];
  loadingProducts: boolean;
  selectedProducts: ProductRow[];
  onSelect: (p: ProductRow) => void;
}) {
  return (
    <div>
      <Label htmlFor="content-product">Cari produk</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
        <Input
          id="content-product"
          value={productQuery}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ketik kode/nama produk"
          className="pl-9"
        />
      </div>
      <FieldHint>
        Pilih 1 produk seperti biasa, atau sampai {MAX_SELECTED_PRODUCTS} produk sekaligus untuk konten
        grup — semua model akan digabung AI jadi tampil BERSAMA dalam 1 frame (bukan foto terpisah per
        produk), fokus brand awareness tanpa rincian kode/warna/bahan. Produk pertama yang kamu klik jadi
        produk utama post ini.
      </FieldHint>

      <div className="mt-3 grid max-h-[38rem] grid-cols-3 gap-2.5 overflow-y-auto rounded-lg border border-border bg-surface/60 p-2.5 sm:grid-cols-4 lg:grid-cols-4">
        {loadingProducts ? (
          <p className="col-span-full py-10 text-center text-sm text-text-faint">Memuat...</p>
        ) : productResults.length === 0 ? (
          <p className="col-span-full py-10 text-center text-sm text-text-faint">
            Tidak ada produk yang cocok.
          </p>
        ) : (
          productResults.map((p) => {
            const order = selectedProducts.findIndex((x) => x.kode === p.kode);
            const active = order >= 0;
            const disabled = !active && selectedProducts.length >= MAX_SELECTED_PRODUCTS;
            return (
              <button
                type="button"
                key={p.kode}
                onClick={() => onSelect(p)}
                disabled={disabled}
                className={cn(
                  "group relative overflow-hidden rounded-lg border-2 text-left transition-all",
                  active
                    ? "border-gold shadow-[0_0_0_3px_rgba(105,126,62,0.12)]"
                    : "border-transparent hover:border-border-strong",
                  disabled && "cursor-not-allowed opacity-40"
                )}
              >
                <div className="flex aspect-square w-full items-center justify-center bg-surface-2">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image}
                      alt={p.nama}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-text-faint" />
                  )}
                </div>
                {active && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[11px] font-semibold text-ink shadow-sm">
                    {selectedProducts.length > 1 ? order + 1 : <Check className="h-3 w-3" />}
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-1 text-[10px] leading-tight text-white">
                  {p.kode}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
