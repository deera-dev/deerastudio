// GET /api/content/instagram-status — status koneksi Instagram utk
// ditampilkan di UI Content Studio (TIDAK PERNAH kembalikan token asli).
import { NextResponse } from "next/server";
import { getInstagramConnectionInfo } from "@/lib/instagram/client";

export async function GET() {
  return NextResponse.json(getInstagramConnectionInfo());
}
