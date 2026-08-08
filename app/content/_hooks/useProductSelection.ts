"use client";
// Pencarian & multi-select produk (maks MAX_SELECTED_PRODUCTS, lihat
// app/content/_lib/types.ts). Produk pertama yang diklik = "primer" — dipakai
// fakta caption (poster/marketing photo/dst tetap pakai primer ini via
// `selectedProduct`). Begitu 2+ produk terpilih, konsumen hook ini
// (page.tsx) masuk ke "mode grup": metadata per-produk disembunyikan, dan
// foto post dihasilkan lewat useGroupCombo (semua produk digabung 1 frame),
// bukan lagi dari daftar foto individual per produk.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_SELECTED_PRODUCTS,
  photoOptionsForProduct,
  type PhotoOption,
  type ProductRow,
} from "../_lib/types";

export function useProductSelection() {
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<ProductRow[]>([]);

  const selectedProduct = selectedProducts[0] ?? null;
  // 2-5 produk terpilih = "mode grup" — foto post dihasilkan lewat "Foto
  // Gabungan Grup" (useGroupCombo, SEMUA produk tampil bersama di 1 frame),
  // bukan lagi pilih foto individual per produk.
  const isGroupContent = selectedProducts.length > 1;

  useEffect(() => {
    let cancelled = false;
    async function search() {
      setLoadingProducts(true);
      const supabase = createClient();
      const base = supabase
        .from("products")
        .select("kode, nama, bahan, image, detail, warna, warna_images, video");
      const { data } = productQuery.trim()
        ? await base
            .or(`kode.ilike.%${productQuery}%,nama.ilike.%${productQuery}%`)
            .order("created_at", { ascending: false })
            .limit(150)
        : await base.order("created_at", { ascending: false }).limit(150);
      if (!cancelled) {
        setProductResults((data as ProductRow[]) ?? []);
        setLoadingProducts(false);
      }
    }
    const t = setTimeout(search, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [productQuery]);

  // Klik produk yang belum aktif -> tambah (sampai MAX_SELECTED_PRODUCTS,
  // produk pertama = primer). Klik yang sudah aktif -> lepas. Kalau primer
  // (index 0) sendiri berganti, reset state turunan lain jadi tanggung
  // jawab page.tsx (lihat useEffect keyed selectedProduct?.kode di sana) —
  // supaya nambah/lepas produk KE-2..5 tidak menghapus progres yang sudah
  // digenerate utk primer.
  function selectProduct(p: ProductRow) {
    setSelectedProducts((prev) => {
      const already = prev.some((x) => x.kode === p.kode);
      if (already) return prev.filter((x) => x.kode !== p.kode);
      if (prev.length >= MAX_SELECTED_PRODUCTS) return prev;
      return [...prev, p];
    });
  }

  function removeProduct(kode: string) {
    setSelectedProducts((prev) => prev.filter((x) => x.kode !== kode));
  }

  // Opsi foto individual — cuma relevan di mode 1-produk (PhotoPickerGrid).
  // Mode grup pakai useGroupCombo, bukan daftar foto individual ini.
  const photoOptions: PhotoOption[] = selectedProduct ? photoOptionsForProduct(selectedProduct) : [];

  return {
    productQuery,
    setProductQuery,
    productResults,
    loadingProducts,
    selectedProducts,
    selectedProduct,
    isGroupContent,
    selectProduct,
    removeProduct,
    photoOptions,
  };
}
