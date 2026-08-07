// Wrapper text-gen — Content Studio (Agustus 2026). Pakai fal.ai
// "openrouter/router" (lihat catatan di lib/fal/client.ts), REUSE FAL_KEY
// yang sama dengan foto — tidak butuh vendor/API key baru sama sekali.
// Server-only, sama seperti lib/prompts/nano-banana-generate.ts.
import { fal, FAL_MODELS, TEXT_MODEL_DEFAULT } from "./client";

export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  model?: string; // default TEXT_MODEL_DEFAULT
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  output: string;
  costUsd: number | null;
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const result = await fal.subscribe(FAL_MODELS.TEXT_ROUTER, {
    input: {
      prompt: input.prompt,
      system_prompt: input.systemPrompt,
      model: input.model ?? TEXT_MODEL_DEFAULT,
      temperature: input.temperature ?? 0.9,
      max_tokens: input.maxTokens ?? 800,
    },
    logs: false,
  });

  const data = result.data as { output: string; error?: string; usage?: { cost?: number } };

  if (data.error) {
    throw new Error(`Text-gen gagal: ${data.error}`);
  }

  return {
    output: data.output,
    costUsd: data.usage?.cost ?? null,
  };
}
