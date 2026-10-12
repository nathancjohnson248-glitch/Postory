import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Postory's one door to a language model. Text and images go to Replicate
 * first (one token for both), then OpenRouter, Gemini, Groq and OpenAI —
 * whichever are configured — and a provider that refuses
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

type TextProvider = "openrouter" | "replicate" | "gemini" | "groq" | "openai";

/** Providers that answered "no access" recently, and until when to skip them. */
const benched = new Map<TextProvider, number>();
const BENCH_MS = 10 * 60_000;

function textProviders(): TextProvider[] {
  const all: TextProvider[] = [];
  if (integrations.replicate()) all.push("replicate");
  if (integrations.openrouter()) all.push("openrouter");
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
  return integrations.replicate() || integrations.cloudflareAi() || integrations.openrouter() || integrations.gemini() || integrations.openai();
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
type StructuredInput<S extends z.ZodType> = {
  system: string;
  turns: ChatTurn[];
  schema: S;
  name: string;
  /** "fast" for quick checks where a smaller model is enough. */
  tier?: "best" | "fast";
};

async function viaGemini<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  const data = await gemini(
    env.geminiModel(),
    {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: input.turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: jsonSchemaFor(input.schema), temperature: 0.5 },
    },
    90_000,
  );
  return geminiText(data);
}

let openrouterClient: OpenAI | null = null;
function openrouter() {
  const apiKey = env.openrouterApiKey();
  if (!apiKey) throw new ConfigurationError("OPENROUTER_API_KEY");
  openrouterClient ??= new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: 90_000,
    maxRetries: 1,
    defaultHeaders: { "HTTP-Referer": "https://postory.lol", "X-Title": "Postory" },
  });
  return openrouterClient;
}

async function viaOpenRouter<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  try {
    const res = await openrouter().chat.completions.create({
      model: input.tier === "fast" ? env.openrouterFastModel() : env.openrouterModel(),
      temperature: 0.5,
      max_tokens: 3500,
      messages: [{ role: "system", content: input.system }, ...input.turns.map((t) => ({ role: t.role, content: t.content }))],
      response_format: { type: "json_schema", json_schema: { name: input.name, strict: true, schema: jsonSchemaFor(input.schema) } },
    });
    return res.choices[0]?.message?.content ?? "";
  } catch (error) {
    const status = (error as { status?: number }).status;
    log.warn("openrouter request failed", { operation: "ai.openrouter", provider: "openrouter", status }, error);
    // 402 = out of credit; treat like "switched off" so the next provider takes over.
    if (status === 401 || status === 402 || status === 403) throw new LlmError("unavailable", "Postory's writer is switched off right now. Try again later.");
    if (status === 429) throw new LlmError("provider_error", "Postory's writer is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Postory's writer hit a problem. Try again.");
  }
}

// --- Replicate ------------------------------------------------------------------

type Prediction = { status?: string; output?: unknown; error?: unknown; urls?: { get?: string }; detail?: string };

/**
 * POST /v1/models/{owner}/{name}/predictions with "Prefer: wait" (Replicate
 * holds the request up to 60s); anything still running is polled until done.
 */
async function replicatePredict(model: string, input: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  const token = env.replicateApiToken();
  if (!token) throw new ConfigurationError("REPLICATE_API_TOKEN");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const deadline = Date.now() + timeoutMs;
  let res: Response;
  try {
    res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: { ...headers, Prefer: "wait=60" },
      body: JSON.stringify({ input }),
      signal: AbortSignal.timeout(Math.min(timeoutMs, 75_000)),
      cache: "no-store",
    });
  } catch (error) {
    log.warn("replicate request failed", { operation: "ai.replicate", provider: "replicate" }, error);
    throw new LlmError("provider_error", "Postory's AI didn't respond. Try again.");
  }
  let prediction = (await res.json().catch(() => ({}))) as Prediction;
  if (!res.ok) {
    log.warn("replicate error response", { operation: "ai.replicate", provider: "replicate", status: res.status });
    // 402 = out of credit; hand over to the next provider.
    if (res.status === 401 || res.status === 402 || res.status === 403) throw new LlmError("unavailable", "Postory's AI is switched off right now. Try again later.");
    if (res.status === 429) throw new LlmError("provider_error", "Postory's AI is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Postory's AI hit a problem. Try again.");
  }
  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() > deadline || !prediction.urls?.get) throw new LlmError("provider_error", "Postory's AI took too long. Try again.");
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(prediction.urls.get, { headers, cache: "no-store" }).catch(() => null);
    if (poll?.ok) prediction = (await poll.json().catch(() => prediction)) as Prediction;
  }
  if (prediction.status !== "succeeded") {
    log.warn("replicate prediction failed", { operation: "ai.replicate", provider: "replicate", status: prediction.status });
    throw new LlmError("provider_error", "Postory's AI hit a problem. Try again.");
  }
  return prediction.output;
}

/** Replicate's Claude takes a plain prompt, so the schema goes in the instructions and the answer is validated after. */
async function viaReplicate<S extends z.ZodType>(input: StructuredInput<S>): Promise<unknown> {
  const prompt =
    input.turns.length === 1
      ? input.turns[0].content
      : input.turns.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n");
  const output = await replicatePredict(
    input.tier === "fast" ? env.replicateFastModel() : env.replicateTextModel(),
    {
      system_prompt: `${input.system}\n\nRespond with only one JSON object that matches this JSON Schema. No prose, no code fences.\n${JSON.stringify(jsonSchemaFor(input.schema))}`,
      prompt,
      max_tokens: 4000,
      temperature: 0.5,
    },
    120_000,
  );
  const text = Array.isArray(output) ? output.join("") : typeof output === "string" ? output : "";
  // Tolerate a stray fence or preamble around the object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
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
      temperature: 0.5,
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
      const out =
        provider === "openrouter"
          ? await viaOpenRouter(input)
          : provider === "replicate"
            ? await viaReplicate(input)
            : provider === "gemini"
            ? await viaGemini(input)
            : provider === "groq"
              ? await viaGroq(input)
              : await viaOpenAI(input);
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
type ImageResult = { bytes: Buffer; contentType: string; extension: string };
type ImageProvider = "replicate" | "cloudflare" | "openrouter" | "gemini" | "openai";

/**
 * One image for a post. Providers are tried in order — Replicate (FLUX),
 * Cloudflare Workers AI, OpenRouter, Gemini, OpenAI — and one that's out of quota or unreachable
 * hands over to the next.
 */
export async function generateImageBytes(prompt: string, shape: ImageShape): Promise<ImageResult> {
  const providers: ImageProvider[] = [];
  if (integrations.replicate()) providers.push("replicate");
  if (integrations.cloudflareAi()) providers.push("cloudflare");
  if (integrations.openrouter()) providers.push("openrouter");
  if (integrations.gemini()) providers.push("gemini");
  if (integrations.openai()) providers.push("openai");
  if (!providers.length) throw new LlmError("unavailable", "Image generation isn't set up on this deployment yet.");

  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      return await imageVia(provider, prompt, shape);
    } catch (error) {
      lastError = error;
      if (error instanceof LlmError && (error.code === "unavailable" || error.code === "provider_error")) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("provider_error", "Image generation hit a problem. Try again.");
}

async function imageVia(provider: ImageProvider, prompt: string, shape: ImageShape): Promise<ImageResult> {
  if (provider === "replicate") {
    const aspectRatio = shape === "portrait" ? "4:5" : shape === "landscape" ? "16:9" : "1:1";
    const output = await replicatePredict(env.replicateImageModel(), { prompt: prompt.slice(0, 2000), aspect_ratio: aspectRatio, output_format: "jpg", output_quality: 90 }, 150_000);
    const url = Array.isArray(output) ? output[0] : output;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new LlmError("invalid_output", "No image came back. Try again.");
    const file = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: "no-store" }).catch(() => null);
    if (!file?.ok) throw new LlmError("provider_error", "Image generation hit a problem. Try again.");
    return { bytes: Buffer.from(await file.arrayBuffer()), contentType: "image/jpeg", extension: "jpg" };
  }
  if (provider === "openrouter") {
    const aspectRatio = shape === "portrait" ? "4:5" : shape === "landscape" ? "16:9" : "1:1";
    let res: Response;
    try {
      res = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.openrouterApiKey()}`, "Content-Type": "application/json", "HTTP-Referer": "https://postory.lol", "X-Title": "Postory" },
        body: JSON.stringify({ model: env.openrouterImageModel(), prompt: prompt.slice(0, 2000), aspect_ratio: aspectRatio, n: 1 }),
        signal: AbortSignal.timeout(150_000),
        cache: "no-store",
      });
    } catch (error) {
      log.warn("openrouter image request failed", { operation: "ai.openrouter.image", provider: "openrouter" }, error);
      throw new LlmError("provider_error", "Image generation didn't respond. Try again.");
    }
    const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string; media_type?: string }[] };
    const image = data.data?.[0];
    if (!res.ok || !image?.b64_json) {
      log.warn("openrouter image error", { operation: "ai.openrouter.image", provider: "openrouter", status: res.status });
      if (res.status === 401 || res.status === 402 || res.status === 403) throw new LlmError("unavailable", "Image generation is switched off right now. Try again later.");
      throw new LlmError("provider_error", "Image generation hit a problem. Try again.");
    }
    const contentType = image.media_type || "image/png";
    return { bytes: Buffer.from(image.b64_json, "base64"), contentType, extension: contentType === "image/jpeg" ? "jpg" : contentType === "image/webp" ? "webp" : "png" };
  }

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
      // 4006 = the daily free allocation is used up; let the next provider take it.
      if (res.status === 401 || res.status === 403 || data.errors?.[0]?.code === 4006) throw new LlmError("unavailable", "Image generation is switched off right now. Try again later.");
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
