"use client";
// Field upload gambar — drag & drop (react-dropzone) dengan preview besar dan
// animasi (framer-motion). Upload ke Supabase Storage (lib/supabase/storage.ts).
// Dipakai di Models, Poses, Generate, Presets.
//
// REVISI Agustus 2026 v2: sebelumnya kotak kosong pakai bg-surface-2 +
// text-text-faint yang NYARIS SAMA TERANGNYA (lihat catatan globals.css)
// — ikon ImagePlus & hint text jadi nyaris tidak terlihat sama sekali
// (laporan admin: "kotak kosong keliatan blank"). Sekarang pakai glass
// translucent + token text-faint yang sudah diperbaiki kontrasnya, plus
// dashed border lebih jelas & hover state yang lebih hidup.
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadToStorage } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

export function ImageUploadField({
  label,
  folder,
  value,
  onChange,
  required = false,
  hint,
  aspect = "aspect-[3/4]",
  // REVISI (Agustus 2026 — dipakai di app/lineup-warna/page.tsx utk ganti
  // foto referensi warna: field itu WAJIB selalu ada isinya, tidak boleh
  // pernah kosong. Sebelumnya tombol "X" di sini memanggil onChange(null),
  // tapi kalau parent-nya cuma terima value baru yang non-null (pola
  // "replace" — lihat handleReplacePhoto di lineup-warna/page.tsx), klik X
  // jadi TIDAK NGAPA-NGAPAIN sama sekali (admin: "gabisa upload ulang
  // bego") krn parent diam-diam menolak update ke null, foto lama tetap
  // nyangkut. allowClear=false menyembunyikan tombol X sepenuhnya —
  // satu-satunya cara ganti foto jadi klik/drag foto baru langsung ke
  // kotaknya (root dropzone selalu bisa diklik utk buka file picker,
  // terlepas dari ada-tidaknya tombol X).
  allowClear = true,
}: {
  label: string;
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
  hint?: string;
  aspect?: string;
  allowClear?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await uploadToStorage(file, folder);
        onChange(url);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload gagal");
      } finally {
        setUploading(false);
      }
    },
    [folder, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
        {required && <span className="text-gold">*</span>}
      </label>

      <div
        {...getRootProps()}
        className={cn(
          "group relative w-full overflow-hidden rounded-xl border-2 border-dashed backdrop-blur-sm transition-colors",
          aspect,
          isDragActive
            ? "border-gold bg-gold/[0.08]"
            : "border-white/[0.14] bg-white/[0.025] hover:border-gold/50 hover:bg-gold/[0.04]",
          uploading && "pointer-events-none opacity-70"
        )}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {value ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt={label} className="h-full w-full object-cover" />
              {allowClear ? (
                <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-text hover:bg-danger/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                // allowClear=false — field ini WAJIB selalu terisi (lihat
                // catatan di props di atas), jadi TIDAK ADA tombol X sama
                // sekali. Satu-satunya affordance ganti foto: klik/drag foto
                // baru ke kotak ini langsung (root dropzone selalu aktif),
                // diberi hint visual jelas saat hover supaya tidak
                // membingungkan spt sebelumnya.
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                  <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-text">
                    Klik utk ganti
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center"
            >
              {uploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
              ) : (
                <ImagePlus className="h-6 w-6 text-text-faint transition-colors group-hover:text-gold-soft" />
              )}
              <p className="text-xs text-text-faint">
                {uploading ? "Mengunggah..." : isDragActive ? "Lepas di sini" : "Tarik foto atau klik"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {hint && <p className="mt-1.5 text-xs text-text-faint">{hint}</p>}
    </div>
  );
}
