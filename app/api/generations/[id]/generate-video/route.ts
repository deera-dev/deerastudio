// DEPRECATED (Agustus 2026, REVISI v2) — route ini adalah versi LAMA
// "Generate Video (AI)" 1-foto-1-video per baris ai_generations. Admin
// minta video digabung dari SEMUA foto post jadi 1 video utuh (bukan
// pilih 1 foto), jadi fitur ini pindah ke level SET (ai_generation_sets),
// bukan per-baris generation lagi — lihat:
//   app/api/generation-sets/[id]/generate-video/route.ts (submit)
//   app/api/generation-sets/[id]/generate-video/status/route.ts (poll)
// File ini TIDAK dipakai UI manapun lagi, dibiarkan sbg stub (bukan
// dihapus — lihat aturan file immutable di CLAUDE.md/catatan sesi) supaya
// tidak ada endpoint lama yang diam-diam berperilaku beda dari yang
// diharapkan kalau ada yang memanggilnya langsung.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint ini sudah tidak dipakai — generate video sekarang di level SET foto (gabungan semua foto jadi 1 video), lihat /api/generation-sets/:id/generate-video.",
    },
    { status: 410 }
  );
}
