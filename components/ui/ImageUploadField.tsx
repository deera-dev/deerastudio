"use client";
// Field upload gambar — drag & drop (react-dropzone) dengan preview besar dan
// animasi (framer-motion). Upload ke Supabase Storage (lib/supabase/storage.ts).
// Dipakai di Models, Poses, Generate, Presets.
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
}: {
  label: string;
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
  hint?: string;
  aspect?: string;
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
          "group relative w-full overflow-hidden rounded-lg border border-dashed transition-colors",
          aspect,
          isDragActive
            ? "border-gold bg-gold/5"
            : "border-border-strong bg-surface-2 hover:border-gold/60",
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
                <ImagePlus className="h-6 w-6 text-text-faint" />
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
