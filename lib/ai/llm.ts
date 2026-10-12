import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Postory's one door to a language model. Text goes to Gemini first, then
 * Groq, then OpenAI — whichever are configured — and a provider that refuses
 * access is skipped for a while so people never wait on a known failure.
 * Images go to Cloudflare Workers AI, then Gemini, then OpenAI; Groq has no
 * image model. Every call asks
 * for JSON matching a zod schema, and the result is validated again by the
 * caller — model output is never trusted as-is.
 */

export class LlmError extends Error {
  constructor(
    public readonly code: "provider_error" | "refused" | "invalid_output" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

const GEMINI = "https://generativelanguage.googleapis.com/v1beta/models";

type TextProvider = "gemini" | "groq" | "openai";

/** Providers that answered "no access" recently, and until when to skip them. */
const benched = new Map<TextProvider, number>();
const BENCH_MS = 10 * 60_000;

function textProviders(): TextProvider[] {
  const all: TextProvider[] = [];
  if (integrations.gemini()) all.push("gemini");
  if (integrations.groq()) all.push("groq");
  if (integrations.openai()) all.push("openai");
  const now = Date.now();
  const ready = all.filter((p) => (benched.get(p) ?? 0) < now);
  // If everything is benched, try them all again rather than refusing outright.
  return ready.length ? ready : all;
}

export function llmProvider(): TextProvider | null {
  return textProviders()[0] ?? null;
}

export function imageAvailable() {
  return integrations.cloudflareAi() || integrations.gemini() || integrations.openai();
}

/** JSON Schema for Gemini's responseJsonSchema, from the zod model schema. */
function jsonSchemaFor(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

type GeminiPart = { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

async function gemini(model: string, body: Record<string, unknown>, timeoutMs: number): Promise<GeminiResponse> {
  const key = env.geminiApiKey();
  if (!key) throw new ConfigurationError("GEMINI_API_KEY");
  let res: Response;
  try {
    res = await fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    log.warn("gemini request failed", { operation: "ai.gemini", provider: "gemini" }, error);
    throw new LlmError("provider_error", "Postory's writer didn't respond. Try again.");
  }
  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    log.warn("gemini error response", { operation: "ai.gemini", provider: "gemini", status: res.status, code: data.error?.status });
    if (res.status === 403 || res.status === 401) throw new LlmError("unavailable", "Postory's writer is switched off right now. Try again later.");
    if (res.status === 429) throw new LlmError("provider_error", "Postory's writer is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Postory's writer hit a problem. Try again.");
  }
  if (data.promptFeedback?.blockReason) throw new LlmError("refused", "The writer declined this request. Rephrase it and try again.");
  return data;
}

function geminiText(data: GeminiResponse) {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("");
}

let openaiClient: OpenAI | null = null;
function openai() {
  const apiKey = env.openaiApiKey();
  if (!apiKey) throw new ConfigurationError("OPENAI_API_KEY");
  openaiClient ??= new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
  return openaiClient;
}

/**
 * One structured call: a system prompt, the conversation (or a single user
 * message), and the schema the answer must follow. Returns the parsed JSON
 * (unvalidated against limits — callers apply their own validated schema).
 */
type StructuredInput<S extends z.ZodType> = { system: string; turns: ChatTurn[]; schema: S; name: string };

async function viaGemini<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  const data = await gemini(
    env.geminiModel(),
    {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: input.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: jsonSchemaFor(input.schema), temperature: 0.7 },
    },
    90_000,
  );
  return geminiText(data);
}

let groqClient: OpenAI | null = null;
function groq() {
  const apiKey = env.groqApiKey();
  if (!apiKey) throw new ConfigurationError("GROQ_API_KEY");
  groqClient ??= new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1", timeout: 60_000, maxRetries: 1 });
  return groqClient;
}

async function viaGroq<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  try {
    const res = await groq().chat.completions.create({
      model: env.groqModel(),
      temperature: 0.7,
      messages: [{ role: "system", content: input.system }, ...input.turns.map((t) => ({ role: t.role, content: t.content }))],
      response_format: { type: "json_schema", json_schema: { name: input.name, strict: true, schema: jsonSchemaFor(input.schema) } },
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (error) {
    const status = (error as { status?: number }).status;
    log.warn("groq request failed", { operation: "ai.groq", provider: "groq", status }, error);
    if (status === 401 || status === 403) throw new LlmError("unavailable", "Postory's writer is switched off right now. Try again later.");
    if (status === 429) throw new LlmError("provider_error", "Postory's writer is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Postory's writer hit a problem. Try again.");
  }
}

async function viaOpenAI<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  let response;
  try {
    response = await openai().responses.parse({
      model: env.openaiModel(),
      input: [{ role: "system", content: input.system }, ...input.turns.map((t) => ({ role: t.role, content: t.content }))],
      text: { format: zodTextFormat(input.schema, input.name) },
    });
  } catch (error) {
    log.warn("openai request failed", { operation: "ai.openai", provider: "openai" }, error);
    throw new LlmError("provider_error", "Postory's writer hit a problem. Try again.");
  }
  if (!response.output_parsed) throw new LlmError("refused", "The writer declined this request. Rephrase it and try again.");
  return response.output_parsed;
}

/**
 * One structured call: a system prompt, the conversation (or a single user
 * message), and the schema the answer must follow. Returns the parsed object
 * (callers still apply their own validated schema with length limits).
 */
export async function generateStructured<S extends z.ZodType>(input: StructuredInput<S>): Promise<z.infer<S>> {
  const providers = textProviders();
  if (!providers.length) throw new LlmError("unavailable", "Postory's writer isn't set up on this deployment yet.");

  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      const out = provider === "gemini" ? await viaGemini(input) : provider === "groq" ? await viaGroq(input) : await viaOpenAI(input);
      let parsed: unknown = out;
      if (typeof out === "string") {
        if (!out.trim()) throw new LlmError("invalid_output", "The writer returned nothing. Try again.");
        try {
          parsed = JSON.parse(out);
        } catch {
          throw new LlmError("invalid_output", "The writer returned something Postory couldn't use. Try again.");
        }
      }
      const result = input.schema.safeParse(parsed);
      if (!result.success) throw new LlmError("invalid_output", "The writer returned something Postory couldn't use. Try again.");
      benched.delete(provider);
      return result.data;
    } catch (error) {
      lastError = error;
      // Only a refused or unreachable provider hands over to the next one.
      if (error instanceof LlmError && (error.code === "unavailable" || error.code === "provider_error")) {
        if (error.code === "unavailable") benched.set(provider, Date.now() + BENCH_MS);
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("provider_error", "Postory's writer hit a problem. Try again.");
}

export type ImageShape = "square" | "portrait" | "landscape";

/** One image for a post. Gemini's image model by default, OpenAI's as fallback. */
export async function generateImageBytes(prompt: string, shape: ImageShape): Promise<{ bytes: Buffer; contentType: string; extension: string }> {
  const provider = integrations.cloudflareAi() ? "cloudflare" : integrations.gemini() ? "gemini" : integrations.openai() ? "openai" : null;
  if (!provider) throw new LlmError("unavailable", "Image generation isn't set up on this deployment yet.");

  if (provider === "cloudflare") {
    const [width, height] = shape === "portrait" ? [1024, 1280] : shape === "landscape" ? [1536, 864] : [1024, 1024];
    let res: Response;
    try {
      res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.cloudflareAccountId()!)}/ai/run/${env.cloudflareImageModel()}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.cloudflareAiToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: prompt.slice(0, 2000), width, height }),
          signal: AbortSignal.timeout(120_000),
          cache: "no-store",
        },
      );
    } catch (error) {
      log.warn("cloudflare image request failed", { operation: "ai.cloudflare.image", provider: "cloudflare" }, error);
      throw new LlmError("provider_error", "Image generation didn't respond. Try again.");
    }
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; result?: { image?: string }; errors?: { code?: number; message?: string }[] };
    if (!res.ok || !data.success || !data.result?.image) {
      log.warn("cloudflare image error", { operation: "ai.cloudflare.image", provider: "cloudflare", status: res.status, code: data.errors?.[0]?.code });
      if (res.status === 401 || res.status === 403) throw new LlmError("unavailable", "Image generation is switched off right now. Try again later.");
      if (res.status === 429) throw new LlmError("provider_error", "Image generation is busy. Try again in a minute.");
      throw new LlmError("provider_error", "Image generation hit a problem. Try again.");
    }
    const bytes = Buffer.from(data.result.image, "base64");
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    return { bytes, contentType: png ? "image/png" : "image/jpeg", extension: png ? "png" : "jpg" };
  }

  if (provider === "gemini") {
    const aspectRatio = shape === "portrait" ? "4:5" : shape === "landscape" ? "16:9" : "1:1";
    const data = await gemini(
      env.geminiImageModel(),
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
      },
      120_000,
    );
    const image = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data)?.inlineData;
    if (!image) throw new LlmError("invalid_output", "No image came back. Try again.");
    const contentType = image.mimeType || "image/png";
    return { bytes: Buffer.from(image.data, "base64"), contentType, extension: contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png" };
  }

  const size = shape === "portrait" ? "1024x1536" : shape === "landscape" ? "1536x1024" : "1024x1024";
  let result;
  try {
    result = await openai().images.generate({ model: env.openaiImageModel(), prompt, size, n: 1, output_format: "png" });
  } catch (error) {
    log.warn("openai image failed", { operation: "ai.openai.image", provider: "openai" }, error);
    throw new LlmError("provider_error", "Image generation hit a problem. Try again.");
  }
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new LlmError("invalid_output", "No image came back. Try again.");
  return { bytes: Buffer.from(b64, "base64"), contentType: "image/png", extension: "png" };
}
