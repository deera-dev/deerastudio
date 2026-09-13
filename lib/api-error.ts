// Helper format error API — Agustus 2026 (admin lapor bug di /generate-bebas:
// "dapet error message [object, object]").
//
// Root cause: beberapa route API mengembalikan `{ error: someZodError.flatten() }`
// (sebuah OBJECT `{formErrors, fieldErrors}`, BUKAN string) saat validasi
// body gagal, atau `{ error: (err as Error).message }` di blok catch —
// tapi tidak semua error yang dilempar (mis. dari fal.ai SDK) benar-benar
// instance `Error` dgn `.message` berupa string; kadang objek lain. Frontend
// yang menaruh `data.error` langsung ke `new Error(data.error)` /
// `toast.error(data.error)` menampilkan "[object Object]" krn JS
// men-stringify object apa adanya, bukan isinya.
//
// Dua helper di file ini memastikan field `error` yang dikirim ke frontend
// SELALU string yang bisa dibaca:
import type { ZodError } from "zod";

// Susun ZodError.flatten() jadi 1 kalimat string.
export function zodErrorMessage(error: ZodError): string {
  const flat = error.flatten();
  const fieldMessages = Object.entries(flat.fieldErrors)
    .filter(([, msgs]) => msgs && msgs.length > 0)
    .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`);
  const messages = [...flat.formErrors, ...fieldMessages];
  return messages.length > 0 ? messages.join("; ") : "Input tidak valid";
}

// Ekstrak pesan yang bisa dibaca dari error APA PUN yang di-catch (Error
// asli, object dari SDK pihak ketiga spt fal.ai, atau string) — dipakai di
// blok catch sebelum dikirim balik ke frontend/disimpan ke kolom
// error_message.
export function errorMessage(err: unknown, fallback = "Terjadi kesalahan"): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.message === "string" && anyErr.message) return anyErr.message;
    if (typeof anyErr.error === "string" && anyErr.error) return anyErr.error;
    try {
      const json = JSON.stringify(err);
      return json && json !== "{}" ? json : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
