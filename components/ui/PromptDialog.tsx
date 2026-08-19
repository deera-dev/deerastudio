"use client";
// Dialog input teks bebas — imperatif, pola SAMA dgn confirmDialog()
// (ConfirmDialog.tsx). Dibuat Agustus 2026 utk fitur "catatan perbaikan"
// di tombol Generate Ulang History (lihat app/history/page.tsx & app/api/
// generations/[id]/regenerate/route.ts): admin sering regenerate BERKALI-
// KALI berharap hasilnya beda krn random seed, padahal maunya kasih
// instruksi SPESIFIK ("jangan ada rak buku di background", "pose kurang
// natural", dst) yang selama ini tidak ada tempatnya. Resolve `null` kalau
// admin Batal (regenerate dibatalkan sama sekali), atau `{ note,
// referenceImageUrl }` kalau submit (note boleh kosong = regenerate biasa
// tanpa catatan).
//
// REVISI (Agustus 2026, segera setelah catatan teks di atas dipakai —
// admin: "cuma saya gabisa kasih image referencenya, bakal lebih bagus
// kalau saya bisa kasih prompt buat benerin beserta dengan image yang saya
// maksud"): tambah field upload foto referensi OPSIONAL
// (`allowImage: true`) — dipakai bareng catatan teks sbg acuan visual
// tambahan saat regenerate (lihat correctionReferenceUrls di
// lib/prompts/nano-banana-generate.ts). Kalau `allowImage` tidak di-set,
// field foto tidak dirender sama sekali (dialog tetap bisa dipakai generik
// utk kasus lain yang cuma butuh teks).
//
// REVISI (Agustus 2026 — admin: "di bagian generate ulang juga cuma bisa
// upload 1 image aja, lebih bagus bisa banyak"): field foto referensi tunggal
// (`imageUrl`) diganti jadi SAMPAI 3 slot (`imageUrls`), dirender sbg grid
// 3 kolom kecil. Slot kosong tidak dikirim (difilter di handle()). Foto
// HASIL GENERATE SEBELUMNYA (previous attempt) TIDAK diupload manual di sini
// — itu otomatis disisipkan server-side dari output_image_url baris yang
// sedang diregenerate, lihat app/api/generations/[id]/regenerate/route.ts.
//
// REVISI BESAR (Agustus 2026, sepaket dgn mode refine di lib/prompts/
// nano-banana-generate.ts & app/api/generations/[id]/regenerate/route.ts):
// tambah checkbox "Kunci Produk" opsional (`allowLockGarment: true`) —
// kalau dicentang, koreksi ini TIDAK regenerate ulang dari flat-lay sama
// sekali, cuma edit foto hasil sebelumnya (garment/model/background dikunci,
// AI cuma ubah apa yg diminta di catatan). Default UNCHECKED — kalau
// masalahnya justru soal garment (motif pudar, detail hilang), admin harus
// BIARKAN tidak dicentang supaya AI regenerate ulang dari flat-lay lagi.
const MAX_REFERENCE_IMAGES = 3;

import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Lock, Wand2 } from "lucide-react";
import { Button } from "./Button";
import { Textarea } from "./Field";
import { ImageUploadField } from "./ImageUploadField";

type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  allowImage?: boolean;
  imageLabel?: string;
  imageHint?: string;
  allowLockGarment?: boolean;
  lockGarmentLabel?: string;
  lockGarmentHint?: string;
};

export type PromptResult = { note: string; referenceImageUrls: string[]; lockGarment: boolean };

type PromptState = PromptOptions & { resolve: (value: PromptResult | null) => void };

let openImpl: ((opts: PromptOptions) => Promise<PromptResult | null>) | null = null;

export function promptDialog(opts: PromptOptions): Promise<PromptResult | null> {
  if (!openImpl) return Promise.resolve(null);
  return openImpl(opts);
}

export function PromptDialogHost() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");
  const [imageUrls, setImageUrls] = useState<(string | null)[]>(
    Array(MAX_REFERENCE_IMAGES).fill(null)
  );
  const [lockGarment, setLockGarment] = useState(false);

  useEffect(() => {
    openImpl = (opts) =>
      new Promise<PromptResult | null>((resolve) => {
        setValue("");
        setImageUrls(Array(MAX_REFERENCE_IMAGES).fill(null));
        setLockGarment(false);
        setState({ ...opts, resolve });
      });
    return () => {
      openImpl = null;
    };
  }, []);

  function handle(result: PromptResult | null) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <Transition show={!!state} as={Fragment}>
      <Dialog onClose={() => handle(null)} className="relative z-50">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md rounded-xl border border-border-strong bg-surface p-6 shadow-2xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold">
                  <Wand2 className="h-5 w-5" />
                </div>
                <DialogTitle className="font-display text-lg font-semibold text-text">
                  {state?.title}
                </DialogTitle>
              </div>
              {state?.description && (
                <p className="mb-3 text-sm leading-relaxed text-text-muted">{state.description}</p>
              )}
              <Textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={state?.placeholder}
                className={state?.allowImage ? "mb-4" : "mb-6"}
              />
              {state?.allowImage && (
                <div className="mb-6">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">
                    {state.imageLabel ?? "Foto Referensi (opsional, sampai 3)"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {imageUrls.map((url, i) => (
                      <ImageUploadField
                        key={i}
                        label={`Referensi ${i + 1}`}
                        folder="corrections"
                        value={url}
                        onChange={(next) =>
                          setImageUrls((prev) => prev.map((u, idx) => (idx === i ? next : u)))
                        }
                        aspect="aspect-square"
                      />
                    ))}
                  </div>
                  {state.imageHint && (
                    <p className="mt-1.5 text-xs text-text-faint">{state.imageHint}</p>
                  )}
                </div>
              )}
              {state?.allowLockGarment && (
                <label className="mb-6 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3.5 py-3">
                  <input
                    type="checkbox"
                    checked={lockGarment}
                    onChange={(e) => setLockGarment(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-transparent accent-gold"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                      <Lock className="h-3.5 w-3.5 text-gold" />
                      {state.lockGarmentLabel ?? "Kunci Produk — jangan generate ulang dari foto asli"}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-faint">
                      {state.lockGarmentHint ??
                        "Pakai kalau produk di hasil sebelumnya SUDAH benar dan cuma pose/background/ketajaman yang mau diperbaiki. AI mengedit foto sebelumnya, bukan menggambar ulang produk. Jangan centang kalau masalahnya soal motif/detail produk itu sendiri."}
                    </span>
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handle(null)}>
                  {state?.cancelLabel ?? "Batal"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    handle({
                      note: value.trim(),
                      referenceImageUrls: imageUrls.filter((u): u is string => Boolean(u)),
                      lockGarment,
                    })
                  }
                >
                  {state?.confirmLabel ?? "Generate Ulang"}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
