// Log terpusat biaya REAL semua panggilan AI (fal.ai) — Agustus 2026.
//
// LATAR BELAKANG (bug ditemukan setelah admin lapor "sudah 2x top up
// fal.ai, top-up pertama $10 sudah habis, tapi dashboard cuma nunjukkin
// sebagian kecil dari itu"): investigasi menemukan DUA masalah —
// 1. Dashboard cuma jumlahin ai_generation_sets.total_cost (pipeline foto
//    Generate/History) — video_cost (History, kolom terpisah di tabel yang
//    SAMA) TIDAK ikut dijumlah sama sekali (bug murni, lihat perbaikan di
//    app/dashboard/page.tsx).
// 2. SEMUA panggilan berbayar di Content Studio SAMA SEKALI TIDAK PERNAH
//    dicatat biayanya di mana pun: caption/headline/storyboard/motion
//    prompt (text-gen Claude Sonnet 4.5 via lib/fal/text.ts — costUsd hasil
//    panggilan DIBUANG begitu saja di setiap pemanggil), "Foto Marketing
//    AI" & "Foto Gabungan Produk" (Nano Banana Pro edit, $0.15/panggilan,
//    TIDAK ADA cost tracking sama sekali), video Content Studio (Kling,
//    stateless jadi tidak ada baris DB permanen utk nyimpen cost-nya).
//
// Modul ini jadi SATU sumber kebenaran independen: setiap panggilan AI
// berbayar dicatat di sini (tabel ai_cost_log, lihat migration
// deera_studio_ai_cost_log) lewat logAiCost(), TERLEPAS dari apakah
// fiturnya juga punya kolom cost sendiri di tabel lain atau tidak.
// Dashboard menjumlah dari SINI untuk kategori yang sebelumnya tidak
// tercatat (lihat app/dashboard/page.tsx), sambil TETAP mempertahankan
// ai_generation_sets.total_cost/video_cost apa adanya (sudah akurat &
// dipakai juga di tempat lain, mis. kartu "Total biaya estimasi" di
// History/Generate — tidak diubah, cuma dijumlah bareng di dashboard).
//
// Server-only — pakai service-role client (bypass RLS) supaya insert bisa
// dipanggil dari mana pun tanpa perlu thread cookies/session Supabase ke
// setiap fungsi lib/prompts/*.ts yang jauh dari request handler asli.
// TIPE/LABEL/usdToRp ada di lib/cost-log-shared.ts (client-safe, lihat
// komentar di file itu kenapa dipisah) — di re-export di sini juga supaya
// kode server yang sudah `import { usdToRp } from "./cost-log"` tetap jalan.
import { createServiceRoleClient } from "./supabase/server";
import type { AiCostFeature } from "./cost-log-shared";

export { usdToRp, FEATURE_LABELS } from "./cost-log-shared";
export type { AiCostFeature } from "./cost-log-shared";

export interface LogAiCostInput {
  feature: AiCostFeature;
  model?: string;
  costUsd: number | null | undefined;
  refType?: "generation_set" | "generation" | "content_post";
  refId?: string;
  note?: string;
}

// Best-effort — SENGAJA tidak pernah throw. Gagal catat biaya TIDAK BOLEH
// menggagalkan fitur utama (generate foto/caption/video tetap harus
// selesai walau logging-nya gagal), cuma di-console.error supaya
// kelihatan di server log kalau ada masalah berulang.
export async function logAiCost(input: LogAiCostInput): Promise<void> {
  if (input.costUsd === null || input.costUsd === undefined || Number.isNaN(input.costUsd)) {
    // Beberapa model (text-gen router) kadang tidak mengembalikan usage.cost
    // — tidak ada yang bisa dicatat, skip diam-diam (bukan error).
    return;
  }
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("ai_cost_log").insert({
      feature: input.feature,
      model: input.model ?? null,
      cost_usd: input.costUsd,
      ref_type: input.refType ?? null,
      ref_id: input.refId ?? null,
      note: input.note ?? null,
    });
    if (error) {
      console.error("[cost-log] Gagal catat biaya:", input.feature, error.message);
    }
  } catch (err) {
    console.error("[cost-log] Gagal catat biaya:", input.feature, err);
  }
}
