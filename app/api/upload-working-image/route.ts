// POST /api/upload-working-image — proxy upload file dari browser ke
// Cloudflare R2 (lib/r2/storage-server.ts) tanpa pernah mengekspos
// R2_SECRET_ACCESS_KEY ke client. Dipakai oleh lib/r2/storage.ts
// (pengganti lib/supabase/storage.ts, yang sebelumnya upload LANGSUNG dari
// browser ke Supabase pakai anon key -- R2 tidak punya skema "anon key
// aman" yang setara utk upload langsung dari browser, jadi lewat satu hop
// server singkat di sini).
import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToStorage } from "@/lib/r2/storage-server";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const folder = form.get("folder");

  if (!(file instanceof File) || typeof folder !== "string" || !folder) {
    return NextResponse.json({ error: "file dan folder wajib diisi" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadBufferToStorage(buffer, folder, file.type || "image/jpeg");
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload gagal" },
      { status: 500 }
    );
  }
}
