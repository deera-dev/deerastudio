"use client";
// "Generate Bebas" (Agustus 2026) — admin: "saya mau ada 1 halaman lagi,
// baru, yaitu saya bisa generate foto ai apapun, tidak hanya untuk produk
// deera, samalah seperti chatgpt ataupun gemini, saya bisa upload foto
// reference dan atau memasukan prompt gambar yang saya mau". Halaman ini
// SENGAJA tidak tahu apa-apa soal produk Deera — prompt admin dikirim apa
// adanya ke AI (lihat lib/prompts/freeform-generate.ts), beda dari semua
// generator lain di app ini yang selalu membungkus prompt dgn instruksi
// fidelity produk.
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label, Select, Textarea, FieldHint } from "@/components/ui/Field";
import { ImageUploadField } from "@/components/ui/ImageUploadField";
import { showImageLightbox } from "@/components/ui/ImageLightbox";
import type { FreeformGeneration } from "@/types/database";

const ASPECT_OPTIONS = [
  { value: "1:1", label: "Persegi (1:1)" },
  { value: "3:4", label: "Potret (3:4)" },
  { value: "4:3", label: "Lanskap (4:3)" },
  { value: "9:16", label: "Story/Reel (9:16)" },
  { value: "16:9", label: "Wide (16:9)" },
];

const REFERENCE_SLOTS = 4;

export default function GenerateBebasPage() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [references, setReferences] = useState<(string | null)[]>(
    Array(REFERENCE_SLOTS).fill(null)
  );
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<FreeformGeneration | null>(null);
  const [history, setHistory] = useState<FreeformGeneration[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/generate-bebas");
      const data = await res.json();
      setHistory(data.items ?? []);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Tulis prompt dulu");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/generate-bebas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          referenceImageUrls: references.filter((r): r is string => !!r),
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Generate gagal");
      setResult(data);
      setHistory((prev) => [data, ...prev]);
      toast.success("Selesai digenerate");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate gagal");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="AI Playground"
        title="Generate Bebas"
        description="Generate gambar AI apa saja, tidak terikat produk Deera — tulis prompt bebas, opsional lampirkan foto referensi, persis seperti ChatGPT/Gemini image gen."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6 lg:order-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wand2 className="h-4 w-4 text-gold" />
                Prompt
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="prompt">Deskripsi gambar</Label>
                <Textarea
                  id="prompt"
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="mis. Poster minimalis kopi hitam di atas meja kayu, cahaya pagi dari jendela, gaya editorial majalah..."
                />
                <FieldHint>Bahasa apa saja bisa, Inggris biasanya lebih akurat dipahami AI.</FieldHint>
              </div>

              <div>
                <Label htmlFor="aspectRatio">Rasio gambar</Label>
                <Select
                  id="aspectRatio"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {ASPECT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Foto referensi (opsional)</Label>
                <FieldHint className="mb-2 mt-0">
                  Kosongkan semua utk generate murni dari teks, atau lampirkan sampai {REFERENCE_SLOTS}{" "}
                  foto utk dijadikan acuan/diedit AI.
                </FieldHint>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {references.map((url, i) => (
                    <ImageUploadField
                      key={i}
                      label={`Ref ${i + 1}`}
                      folder="freeform"
                      value={url}
                      onChange={(newUrl) =>
                        setReferences((prev) => prev.map((r, idx) => (idx === i ? newUrl : r)))
                      }
                    />
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerate} disabled={generating || !prompt.trim()}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Menggenerate...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Generate
                  </>
                )}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat</CardTitle>
            </CardHeader>
            <CardBody>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-10 text-text-faint">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-faint">Belum ada riwayat generate.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!item.output_image_url}
                      onClick={() =>
                        item.output_image_url && showImageLightbox(item.output_image_url, item.prompt)
                      }
                      className="group relative aspect-square overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]"
                      title={
                        item.status === "failed" && item.error_message
                          ? `Gagal: ${item.error_message}`
                          : item.prompt
                      }
                    >
                      {item.output_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.output_image_url}
                          alt={item.prompt}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : item.status === "failed" ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 overflow-hidden p-1.5 text-center text-danger">
                          <span className="text-[10px] font-medium">Gagal</span>
                          {item.error_message && (
                            <span className="line-clamp-4 break-words text-[9px] leading-tight text-text-muted">
                              {item.error_message}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-text-faint" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="h-fit lg:order-1 lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle className="text-base">Hasil</CardTitle>
          </CardHeader>
          <CardBody>
            {generating ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-faint">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-xs">Biasanya 20-60 detik...</p>
              </div>
            ) : result?.output_image_url ? (
              <button
                type="button"
                onClick={() => showImageLightbox(result.output_image_url as string, result.prompt)}
                className="block w-full overflow-hidden rounded-xl border border-white/[0.08]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.output_image_url} alt={result.prompt} className="w-full object-cover" />
              </button>
            ) : (
              <p className="py-16 text-center text-sm text-text-faint">
                Hasil generate akan muncul di sini.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
