// POST /api/content/generate-calendar — Content Studio.
// Generate SEKALIGUS beberapa draft content_posts tersebar di 1 bulan,
// rotasi produk (yang sudah punya foto di katalog) x 4 tema. SEMUA baris
// yang dibuat berstatus "scheduled" tapi TETAP draft dalam arti belum
// publish — admin wajib review/edit tiap caption sebelum publish manual,
// sama seperti alur single-post.
//
// CATATAN PRODUKSI: endpoint ini SINKRON dan memanggil LLM berkali-kali
// (1x per post yang dibuat) — bisa makan waktu 1-2 menit utk kalender
// penuh, sama seperti pola long-running lain di app ini (lihat catatan di
// app/api/generate-set/route.ts).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCaption, type ContentTheme } from "@/lib/prompts/content-generate";

const requestSchema = z.object({
  monthStart: z.string(), // "YYYY-MM-DD", tanggal 1 bulan yang dituju
  postsPerWeek: z.number().int().min(1).max(5).default(3),
});

// Pola hari (Senin=0 .. Minggu=6) per jumlah post/minggu yang diminta —
// disebar rata, bukan numpuk di awal minggu.
const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [2], // Rabu
  2: [1, 4], // Selasa, Jumat
  3: [0, 2, 4], // Senin, Rabu, Jumat
  4: [0, 1, 3, 4], // Senin, Selasa, Kamis, Jumat
  5: [0, 1, 2, 3, 4], // Senin-Jumat
};

const THEME_ROTATION: ContentTheme[] = [
  "brand_awareness",
  "tips_styling",
  "produk_highlight",
  "brand_story",
  "brand_awareness",
  "promo",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function getScheduledDates(monthStart: string, postsPerWeek: number): string[] {
  const [year, month] = monthStart.split("-").map(Number);
  const pattern = WEEKDAY_PATTERN[postsPerWeek] ?? WEEKDAY_PATTERN[3];
  const lastDay = new Date(year, month, 0).getDate(); // month sudah 1-indexed dari input

  const dates: string[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    const jsWeekday = d.getDay(); // 0=Min..6=Sab
    const mondayIndexed = jsWeekday === 0 ? 6 : jsWeekday - 1; // 0=Sen..6=Min
    if (pattern.includes(mondayIndexed)) {
      // Jam 09:00 WIB (+07:00) — cuma saran awal, admin bebas edit jadwalnya.
      dates.push(`${year}-${pad(month)}-${pad(day)}T09:00:00+07:00`);
    }
  }
  return dates;
}

export async function POST(req: NextRequest) {
  const body = requestSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: productsRaw } = await supabase
    .from("products")
    .select("kode, nama, bahan, warna, variants, image")
    .not("image", "is", null)
    .order("created_at", { ascending: false })
    .limit(30);
  const products = productsRaw ?? [];

  if (products.length === 0) {
    return NextResponse.json(
      { error: "Belum ada produk dengan foto di katalog — tidak ada yang bisa dijadikan konten" },
      { status: 400 }
    );
  }

  const scheduledDates = getScheduledDates(body.data.monthStart, body.data.postsPerWeek);

  const created: { id: string; productKode: string; scheduledAt: string }[] = [];
  const failed: { productKode: string; scheduledAt: string; error: string }[] = [];

  for (let i = 0; i < scheduledDates.length; i++) {
    const product = products[i % products.length];
    const theme = THEME_ROTATION[i % THEME_ROTATION.length];
    const scheduledAt = scheduledDates[i];

    const variants = (product.variants as { size: string; harga: number }[] | null) ?? [];
    const hargaList = variants.map((v) => v.harga).filter((h): h is number => typeof h === "number");

    try {
      const { caption, hashtags } = await generateCaption({
        product: {
          kode: product.kode,
          nama: product.nama,
          bahan: product.bahan,
          warna: product.warna as string[] | null,
          ukuran: variants.map((v) => v.size),
          hargaMin: hargaList.length ? Math.min(...hargaList) : null,
          hargaMax: hargaList.length ? Math.max(...hargaList) : null,
        },
        theme,
        contentType: "feed_single",
      });

      const { data: inserted, error } = await supabase
        .from("content_posts")
        .insert({
          product_kode: product.kode,
          image_urls: [product.image],
          content_type: "feed_single",
          theme,
          caption,
          hashtags,
          scheduled_at: scheduledAt,
          status: "scheduled",
          created_by_email: user?.email ?? null,
        })
        .select("id")
        .single();

      if (error || !inserted) throw new Error(error?.message || "Gagal simpan ke database");
      created.push({ id: inserted.id, productKode: product.kode, scheduledAt });
    } catch (err) {
      failed.push({
        productKode: product.kode,
        scheduledAt,
        error: err instanceof Error ? err.message : "Gagal generate",
      });
    }
  }

  return NextResponse.json({ created, failed });
}
