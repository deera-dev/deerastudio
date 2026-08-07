// GET /api/generation-sets/:id — PRD §15. Detail satu set + 5 gambar anaknya.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: set, error } = await supabase
    .from("ai_generation_sets")
    .select("*, ai_generations(*)")
    .eq("id", id)
    .single();

  if (error || !set) {
    return NextResponse.json({ error: "Generation set tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(set);
}
