"use client";
// Lightbox foto full-screen (Agustus 2026 — admin: "saya mau di mobile,
// ketika klik gambar, bisa diliat full screen"). Grid thumbnail hasil
// generate (History & Generate) kecil-kecil dan susah diperiksa detailnya
// di HP tanpa pinch-zoom native browser yang canggung di dalam scroll
// container. Dipanggil IMPERATIF dari mana saja lewat showImageLightbox(),
// pola yang sama dengan confirmDialog() di ConfirmDialog.tsx — host-nya
// (ImageLightboxHost) dipasang sekali di root layout.
//
// UX: tap DI MANA SAJA (backdrop maupun foto itu sendiri) buat nutup —
// paling natural di mobile, tidak perlu cari tombol close kecil dulu.
// Tombol X di pojok tetap ada sbg affordance eksplisit + utk desktop.
import { Fragment, useEffect, useState } from "react";
import { Dialog, Transition, TransitionChild } from "@headlessui/react";
import { X } from "lucide-react";

type LightboxState = { src: string; alt?: string };

let openImpl: ((state: LightboxState) => void) | null = null;

export function showImageLightbox(src: string, alt?: string) {
  openImpl?.({ src, alt });
}

export function ImageLightboxHost() {
  const [state, setState] = useState<LightboxState | null>(null);

  useEffect(() => {
    openImpl = (s) => setState(s);
    return () => {
      openImpl = null;
    };
  }, []);

  function close() {
    setState(null);
  }

  return (
    <Transition show={!!state} as={Fragment}>
      <Dialog onClose={close} className="relative z-[60]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/95 p-3"
            onClick={close}
          >
            {state && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.src}
                alt={state.alt ?? ""}
                className="max-h-[92vh] max-w-[96vw] rounded-lg object-contain"
              />
            )}
          </div>
        </TransitionChild>

        <button
          type="button"
          onClick={close}
          className="fixed right-3 top-3 z-[61] flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>
      </Dialog>
    </Transition>
  );
}
