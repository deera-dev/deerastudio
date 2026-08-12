"use client";
// Dialog input teks bebas — imperatif, pola SAMA dgn confirmDialog()
// (ConfirmDialog.tsx). Dibuat Agustus 2026 utk fitur "catatan perbaikan"
// di tombol Generate Ulang History (lihat app/history/page.tsx & app/api/
// generations/[id]/regenerate/route.ts): admin sering regenerate BERKALI-
// KALI berharap hasilnya beda krn random seed, padahal maunya kasih
// instruksi SPESIFIK ("jangan ada rak buku di background", "pose kurang
// natural", dst) yang selama ini tidak ada tempatnya. Return string kosong
// kalau admin submit tanpa isi apa-apa (regenerate biasa, tanpa catatan
// tambahan), atau `null` kalau admin Batal (regenerate dibatalkan sama
// sekali).
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Wand2 } from "lucide-react";
import { Button } from "./Button";
import { Textarea } from "./Field";

type PromptOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PromptState = PromptOptions & { resolve: (value: string | null) => void };

let openImpl: ((opts: PromptOptions) => Promise<string | null>) | null = null;

export function promptDialog(opts: PromptOptions): Promise<string | null> {
  if (!openImpl) return Promise.resolve(null);
  return openImpl(opts);
}

export function PromptDialogHost() {
  const [state, setState] = useState<PromptState | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    openImpl = (opts) =>
      new Promise<string | null>((resolve) => {
        setValue("");
        setState({ ...opts, resolve });
      });
    return () => {
      openImpl = null;
    };
  }, []);

  function handle(result: string | null) {
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
                className="mb-6"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handle(null)}>
                  {state?.cancelLabel ?? "Batal"}
                </Button>
                <Button variant="primary" size="sm" onClick={() => handle(value.trim())}>
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
