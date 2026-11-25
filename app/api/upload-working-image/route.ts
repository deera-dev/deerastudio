// POST /api/upload-working-image — proxy upload file dari browser ke
// Cloudinary (lib/cloudinary/storage-server.ts) tanpa pernah mengekspos
// CLOUDINARY_API_SECRET ke client. Dipakai oleh lib/cloudinary/storage.ts
// (pengganti lib/supabase/storage.ts, yang sebelumnya upload LANGSUNG dari
// browser ke Supabase pakai anon key -- Cloudinary tidak punya skema
// "anon key aman" yang setara utk upload langsung dari browser tanpa
// upload preset, jadi lewat satu hop server singkat di sini).
import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToStorage } from "@/lib/cloudinary/storage-server";

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
