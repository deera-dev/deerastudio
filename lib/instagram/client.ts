// Instagram Graph API — publish konten Content Studio ke akun Instagram
// Business. SERVER-ONLY, access token TIDAK PERNAH dikirim ke client.
//
// PRASYARAT (Agustus 2026, Meta Graph API v26.0) — WAJIB disiapkan Denny
// sendiri lewat Meta for Developers SEBELUM fitur publish ini bisa jalan
// (lihat README §Instagram):
//   1. Akun Instagram Professional (Business/Creator) terhubung ke sebuah
//      Facebook Page.
//   2. Meta Developer App terdaftar, dengan permission
//      instagram_business_basic + instagram_business_content_publish.
//   3. App Review dari Meta disetujui utk permission di atas — proses ini
//      di pihak Meta, biasanya 2-4 minggu, DI LUAR kendali aplikasi ini.
//   4. Long-lived access token (masa berlaku ~60 hari, perlu di-refresh
//      berkala secara manual/cron terpisah) + Instagram Business Account ID.
// Isi INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_BUSINESS_ACCOUNT_ID di .env begitu
// 4 poin di atas selesai. Sebelum itu, isInstagramConfigured() = false dan
// semua fungsi publish di bawah akan menolak dgn pesan jelas (bukan silent
// fail) — Content Studio tetap bisa dipakai penuh utk generate+edit
// caption/kalender, admin tinggal copy-paste manual sampai koneksi ini siap.
//
// Batasan yang diketahui (per dokumentasi resmi Meta, Agustus 2026):
// - Rate limit: 25 post published per 24 jam per akun Instagram.
// - Reels butuh video_url ASLI (bukan foto) — produk tanpa products.video
//   tidak bisa dipakai utk content_type "reel".
// - Instagram Stories TIDAK BISA dipublish lewat Graph API sama sekali
//   (tidak didukung Meta) — di luar scope content_type yang kita punya.
const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID);
}

// Dipakai API route status — TIDAK PERNAH kembalikan token asli ke client,
// cuma info konfigurasi sudah ada/belum + 4 digit terakhir ID akun (bantu
// verifikasi akun yang benar tanpa expose apa pun sensitif).
export function getInstagramConnectionInfo() {
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  return {
    configured: isInstagramConfigured(),
    businessAccountIdMasked: businessAccountId
      ? `...${businessAccountId.slice(-4)}`
      : null,
    graphApiVersion: GRAPH_API_VERSION,
  };
}

function requireConfig(): { accessToken: string; businessAccountId: string } {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!accessToken || !businessAccountId) {
    throw new Error(
      "Instagram belum terhubung — set INSTAGRAM_ACCESS_TOKEN & INSTAGRAM_BUSINESS_ACCOUNT_ID di .env (butuh Meta App Review disetujui dulu, lihat README §Instagram)."
    );
  }
  return { accessToken, businessAccountId };
}

async function graphPost(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Instagram API error (HTTP ${res.status})`);
  }
  return data as { id: string };
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Instagram API error (HTTP ${res.status})`);
  }
  return data as { status_code?: string };
}

// Video (Reels) butuh waktu diproses Meta sebelum bisa dipublish — beda dari
// foto yang biasanya langsung siap. Poll status_code sampai FINISHED.
async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  timeoutMs = 120_000
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await graphGet(`/${containerId}`, {
      fields: "status_code",
      access_token: accessToken,
    });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error("Instagram gagal memproses media container ini (status_code: ERROR)");
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Timeout menunggu Instagram selesai memproses media container");
}

export interface PublishResult {
  mediaId: string;
}

// Publishing dua-langkah standar Graph API: buat media container, lalu
// media_publish pakai creation_id-nya — sama utk semua content_type di
// bawah, cuma parameter container-nya yang beda.
export async function publishFeedSingle(input: {
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  const { accessToken, businessAccountId } = requireConfig();
  const container = await graphPost(`/${businessAccountId}/media`, {
    image_url: input.imageUrl,
    caption: input.caption,
    access_token: accessToken,
  });
  const published = await graphPost(`/${businessAccountId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });
  return { mediaId: published.id };
}

export async function publishCarousel(input: {
  imageUrls: string[]; // 2-10, aturan Instagram
  caption: string;
}): Promise<PublishResult> {
  if (input.imageUrls.length < 2 || input.imageUrls.length > 10) {
    throw new Error("Carousel Instagram butuh 2-10 foto");
  }
  const { accessToken, businessAccountId } = requireConfig();

  const childIds: string[] = [];
  for (const imageUrl of input.imageUrls) {
    const child = await graphPost(`/${businessAccountId}/media`, {
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: accessToken,
    });
    childIds.push(child.id);
  }

  const parent = await graphPost(`/${businessAccountId}/media`, {
    media_type: "CAROUSEL",
    caption: input.caption,
    children: childIds.join(","),
    access_token: accessToken,
  });

  const published = await graphPost(`/${businessAccountId}/media_publish`, {
    creation_id: parent.id,
    access_token: accessToken,
  });
  return { mediaId: published.id };
}

export async function publishReel(input: {
  videoUrl: string;
  caption: string;
}): Promise<PublishResult> {
  const { accessToken, businessAccountId } = requireConfig();
  const container = await graphPost(`/${businessAccountId}/media`, {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    access_token: accessToken,
  });
  await waitForContainerReady(container.id, accessToken);
  const published = await graphPost(`/${businessAccountId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });
  return { mediaId: published.id };
}
