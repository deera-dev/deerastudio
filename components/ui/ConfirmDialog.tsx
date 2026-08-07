"use client";
// Ganti window.confirm — modal konfirmasi bergaya tema studio. Dipanggil
// imperatif lewat confirmDialog({...}) dari mana saja, mirip API toast().
// Host-nya (ConfirmDialogHost) dipasang sekali di root layout.
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = ConfirmOptions & { resolve: (value: boolean) => void };

let openImpl: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (!openImpl) return Promise.resolve(window.confirm(opts.title));
  return openImpl(opts);
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    openImpl = (opts) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve });
      });
    return () => {
      openImpl = null;
    };
  }, []);

  function handle(result: boolean) {
    state?.resolve(result);
    setState(null);
  }

  return (
    <Transition show={!!state} as={Fragment}>
      <Dialog onClose={() => handle(false)} className="relative z-50">
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
            <DialogPanel className="w-full max-w-sm rounded-xl border border-border-strong bg-surface p-6 shadow-2xl">
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    state?.danger ? "bg-danger-soft text-danger" : "bg-gold/10 text-gold"
                  )}
                >
                  <TriangleAlert className="h-5 w-5" />
                </div>
                <DialogTitle className="font-display text-lg font-semibold text-text">
                  {state?.title}
                </DialogTitle>
              </div>
              {state?.description && (
                <p className="mb-6 text-sm leading-relaxed text-text-muted">{state.description}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => handle(false)}>
                  {state?.cancelLabel ?? "Batal"}
                </Button>
                <Button
                  variant={state?.danger ? "danger" : "primary"}
                  size="sm"
                  onClick={() => handle(true)}
                >
                  {state?.confirmLabel ?? "Ya, lanjutkan"}
                </Button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
