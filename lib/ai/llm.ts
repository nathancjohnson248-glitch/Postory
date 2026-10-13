import "server-only";

import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { OWNER_EMAILS } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/log";

/**
 * Postory's one door to its models, all server-side:
 *
 *   text    any OpenAI-compatible chat completions API
 *           AI_TEXT_BASE_URL   e.g. https://api.groq.com/openai/v1
 *           AI_TEXT_API_KEY
 *           AI_TEXT_MODEL      the writer
 *           AI_TEXT_FAST_MODEL quick checks (defaults to AI_TEXT_MODEL)
 *   images  any OpenAI-compatible images API (AI_IMAGE_BASE_URL, AI_IMAGE_API_KEY,
 *           AI_IMAGE_MODEL), with Replicate (REPLICATE_API_TOKEN) as the fallback
 *
 * Every text call puts the JSON Schema in the instructions, extracts the
 * object from the answer, and validates it with zod. A malformed answer is
 * retried once; model output is never trusted as-is, and callers validate
 * again with their own limits.
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

export function llmProvider(): "text" | null {
  return integrations.aiText() ? "text" : null;
}

export function imageAvailable() {
  return integrations.aiImage() || integrations.replicate();
}

const SAVED = "Anything you wrote is saved, so try again in a few minutes.";

// --- Owner alerts -----------------------------------------------------------------

const lastAlert = new Map<string, number>();

/** Email the owner (at most every six hours per problem) when a provider refuses Postory's account. */
function alertOwner(key: string, alert: { title: string; body: string; actionLabel: string; actionUrl: string }) {
  if (Date.now() - (lastAlert.get(key) ?? 0) < 6 * 3_600_000) return;
  lastAlert.set(key, Date.now());
  log.error("ai provider refused the account", { operation: "ai.account", reason: key });
  void sendEmail(OWNER_EMAILS[0], "ownerAlert", alert).catch(() => undefined);
}

// --- Text: OpenAI-compatible chat completions ------------------------------------------------------------

type StructuredInput<S extends z.ZodType> = {
  system: string;
  turns: ChatTurn[];
  schema: S;
  name: string;
  /** "fast" for quick checks where a smaller model is enough. */
  tier?: "best" | "fast";
};

/** JSON Schema for the instructions, from the zod model schema. */
function jsonSchemaFor(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

export function withSchema(system: string, schema: z.ZodType) {
  return `${system}\n\nRespond with only one JSON object that matches this JSON Schema. No prose, no code fences.\n${JSON.stringify(jsonSchemaFor(schema))}`;
}

/** Pull the JSON object out of the answer, tolerating a stray fence or preamble. */
export function extractObject(text: string): unknown {
  if (!text.trim()) throw new LlmError("invalid_output", "Postory's AI returned nothing. Try again.");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
  }
}

/** The request Postory sends: a standard OpenAI-style chat completion. */
export function chatRequest(input: { model: string; system: string; turns: ChatTurn[]; maxTokens: number }) {
  return {
    model: input.model,
    messages: [{ role: "system" as const, content: input.system }, ...input.turns.map((t) => ({ role: t.role, content: t.content }))],
    max_tokens: input.maxTokens,
    temperature: 0.5,
  };
}

/** POST {base}/chat/completions with the API key. Returns the assistant's text. */
async function chatCompletion(model: string, system: string, turns: ChatTurn[], maxTokens: number): Promise<string> {
  const token = env.aiTextApiKey();
  const base = env.aiTextBaseUrl();
  if (!token || !base) throw new ConfigurationError("AI_TEXT_API_KEY");
  const url = `${base}/chat/completions`;

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chatRequest({ model, system, turns, maxTokens })),
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
    } catch (error) {
      log.warn("ai text request failed", { operation: "ai.text", provider: base, model, url, cause: String((error as { cause?: unknown }).cause ?? "") }, error);
      throw new LlmError("provider_error", `Postory's AI didn't respond. ${SAVED}`);
    }

    const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } };
    if (res.ok) {
      // A plain "OK" page (a retired or wrong endpoint) is not a chat completion.
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new LlmError("invalid_output", "Postory's AI returned nothing. Try again.");
      return text;
    }

    log.warn("ai text error response", { operation: "ai.text", provider: base, model, status: res.status, code: data.error?.code });
    if (res.status === 429) {
      // A per-minute limit clears quickly: wait it out once. A daily cap doesn't.
      const wait = Number(res.headers.get("retry-after")) || 0;
      if (attempt === 0 && wait > 0 && wait <= 20) {
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      if (wait > 20) {
        alertOwner("text-limit", {
          title: "Postory's AI provider is rate-limiting",
          body: `${base} is refusing requests for the next ${Math.round(wait / 60)} minutes. That usually means a free-tier daily cap: upgrade the plan with that provider, or point AI_TEXT_BASE_URL / AI_TEXT_API_KEY / AI_TEXT_MODEL in Railway at another provider.`,
          actionLabel: "Open Railway",
          actionUrl: "https://railway.com/dashboard",
        });
      }
      throw new LlmError("provider_error", `Postory's AI is busy right now. ${SAVED}`);
    }
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      alertOwner("text-key", {
        title: res.status === 402 ? "Postory's AI provider is out of credit" : "Postory's AI provider rejected the API key",
        body: `${base} answered ${res.status}. Add credit there, or fix AI_TEXT_API_KEY in Railway. Every AI request fails until it's fixed.`,
        actionLabel: "Open Railway",
        actionUrl: "https://railway.com/dashboard",
      });
      throw new LlmError("unavailable", `Postory's AI couldn't respond just now. ${SAVED}`);
    }
    if (res.status === 404 || res.status === 410 || /model/i.test(data.error?.code ?? "")) {
      alertOwner("text-model", {
        title: `Postory's AI provider can't run ${model}`,
        body: `${base} answered ${res.status} for "${model}". Check AI_TEXT_BASE_URL, AI_TEXT_MODEL and AI_TEXT_FAST_MODEL in Railway.`,
        actionLabel: "Open Railway",
        actionUrl: "https://railway.com/dashboard",
      });
      throw new LlmError("unavailable", `Postory's AI couldn't respond just now. ${SAVED}`);
    }
    if (res.status === 400 && /content|filter|policy/i.test(data.error?.code ?? data.error?.message ?? "")) {
      throw new LlmError("refused", "The AI's safety filter declined this one. Try rewording it.");
    }
    throw new LlmError("provider_error", `Postory's AI hit a problem. ${SAVED}`);
  }
}

/**
 * One structured call: a system prompt, the conversation (or a single user
 * message), and the schema the answer must follow. Returns the parsed object
 * (callers still apply their own validated schema with length limits).
 */
export async function generateStructured<S extends z.ZodType>(input: StructuredInput<S>): Promise<z.infer<S>> {
  if (!integrations.aiText()) throw new LlmError("unavailable", "Postory's AI isn't set up on this deployment yet.");
  const fast = input.tier === "fast";
  const model = fast ? env.aiTextFastModel() : env.aiTextModel();
  const system = withSchema(input.system, input.schema);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await chatCompletion(model, system, input.turns, fast ? Math.round(env.aiTextMaxTokens() / 2) : env.aiTextMaxTokens());
      const result = input.schema.safeParse(extractObject(text));
      if (!result.success) throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
      return result.data;
    } catch (error) {
      lastError = error;
      // A malformed answer is worth one more try; anything else goes back to the caller.
      if (!(error instanceof LlmError && error.code === "invalid_output")) throw error;
      log.warn("model output rejected, retrying", { operation: `ai.${input.name}`, provider: "text", model, attempt });
    }
  }
  throw lastError;
}

/** A tiny real request, for the owner's health check. */
export async function checkTextModel() {
  const started = Date.now();
  const result = await generateStructured({
    system: "You are a health check.",
    turns: [{ role: "user", content: 'Reply with {"ok": true}.' }],
    schema: z.object({ ok: z.boolean() }),
    name: "health_check",
    tier: "fast",
  });
  return { ok: result.ok, model: env.aiTextFastModel(), baseUrl: env.aiTextBaseUrl(), ms: Date.now() - started };
}

// --- Images: Replicate ------------------------------------------------------------

type Prediction = { id?: string; status?: string; output?: unknown; error?: unknown; urls?: { get?: string } };

/**
 * POST /v1/models/{owner}/{name}/predictions with "Prefer: wait" (Replicate
 * holds the request up to 60s); anything still running is polled until done
 * or the deadline passes. https://replicate.com/docs/reference/http
 */
async function predict(model: string, input: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
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
    log.warn("replicate request failed", { operation: "ai.replicate.image", provider: "replicate", model }, error);
    throw new LlmError("provider_error", "Image generation didn't respond. Nothing was lost, so try again.");
  }

  let prediction = (await res.json().catch(() => ({}))) as Prediction;
  if (!res.ok) {
    log.warn("replicate error response", { operation: "ai.replicate.image", provider: "replicate", model, status: res.status });
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 404) {
      alertOwner(`replicate-${res.status}`, {
        title: res.status === 402 ? "Replicate is out of credit" : res.status === 404 ? `Replicate can't find ${model}` : "Replicate rejected Postory's token",
        body:
          res.status === 402
            ? "Image generation is failing until credit is added. Add credit at replicate.com/account/billing; Postory recovers by itself."
            : "Check REPLICATE_API_TOKEN and REPLICATE_IMAGE_MODEL in Railway. Image generation fails until it's fixed.",
        actionLabel: res.status === 402 ? "Add Replicate credit" : "Open Railway",
        actionUrl: res.status === 402 ? "https://replicate.com/account/billing" : "https://railway.com/dashboard",
      });
      throw new LlmError("unavailable", `Image generation couldn't run just now. ${SAVED}`);
    }
    if (res.status === 422) throw new LlmError("provider_error", "Image generation couldn't take that request. Try rewording it.");
    if (res.status === 429) throw new LlmError("provider_error", "Image generation is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Image generation hit a problem. Nothing was lost, so try again.");
  }

  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() > deadline || !prediction.urls?.get) {
      // Don't leave a long job running (and billing) after we've given up on it.
      if (prediction.id) void fetch(`https://api.replicate.com/v1/predictions/${prediction.id}/cancel`, { method: "POST", headers }).catch(() => undefined);
      throw new LlmError("provider_error", "Image generation took too long. Try again.");
    }
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(prediction.urls.get, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (poll?.ok) prediction = (await poll.json().catch(() => prediction)) as Prediction;
  }

  if (prediction.status !== "succeeded") {
    const detail = typeof prediction.error === "string" ? prediction.error : "";
    log.warn("replicate prediction failed", { operation: "ai.replicate.image", provider: "replicate", model, status: prediction.status, detail: detail.slice(0, 200) });
    // Image models refuse unsafe prompts with an NSFW / safety error.
    if (/nsfw|safety|flagged|sensitive/i.test(detail)) throw new LlmError("refused", "That image request was declined by the model's safety filter. Try a different description.");
    throw new LlmError("provider_error", "Image generation hit a problem. Nothing was lost, so try again.");
  }
  return prediction.output;
}

export type ImageShape = "square" | "portrait" | "landscape";
type ImageResult = { bytes: Buffer; contentType: string; extension: string };

const ASPECT: Record<ImageShape, string> = { square: "1:1", portrait: "4:5", landscape: "16:9" };

const SIZE: Record<ImageShape, string> = { square: "1024x1024", portrait: "1024x1280", landscape: "1536x864" };

/** POST {base}/images/generations (OpenAI shape). Returns the image bytes. */
async function imageViaApi(prompt: string, shape: ImageShape): Promise<ImageResult> {
  const base = env.aiImageBaseUrl()!;
  const model = env.aiImageModel();
  let res: Response;
  try {
    res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.aiImageApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: prompt.slice(0, 3000), size: SIZE[shape], n: 1, response_format: "b64_json" }),
      signal: AbortSignal.timeout(150_000),
      cache: "no-store",
    });
  } catch (error) {
    log.warn("image request failed", { operation: "ai.image", provider: base, model }, error);
    throw new LlmError("provider_error", "Image generation didn't respond. Nothing was lost, so try again.");
  }
  const data = (await res.json().catch(() => ({}))) as { data?: { b64_json?: string; url?: string }[]; error?: { message?: string; code?: string } };
  if (!res.ok) {
    log.warn("image error response", { operation: "ai.image", provider: base, model, status: res.status, code: data.error?.code });
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 404) {
      alertOwner(`image-${res.status}`, {
        title: res.status === 402 ? "The image provider is out of credit" : "The image provider refused Postory's request",
        body: `${base} answered ${res.status} for ${model}. Top up the account, or check AI_IMAGE_API_KEY / AI_IMAGE_MODEL in Railway.`,
        actionLabel: "Open Railway",
        actionUrl: "https://railway.com/dashboard",
      });
      throw new LlmError("unavailable", `Image generation couldn't run just now. ${SAVED}`);
    }
    if (res.status === 400 && /safety|content|policy|moderation/i.test(`${data.error?.code} ${data.error?.message}`)) {
      throw new LlmError("refused", "That image request was declined by the model's safety filter. Try a different description.");
    }
    if (res.status === 429) throw new LlmError("provider_error", "Image generation is busy. Try again in a minute.");
    throw new LlmError("provider_error", "Image generation hit a problem. Nothing was lost, so try again.");
  }
  const item = data.data?.[0];
  let bytes: Buffer | null = null;
  if (item?.b64_json) bytes = Buffer.from(item.b64_json, "base64");
  else if (item?.url?.startsWith("https://")) {
    const file = await fetch(item.url, { signal: AbortSignal.timeout(60_000), cache: "no-store" }).catch(() => null);
    if (file?.ok) bytes = Buffer.from(await file.arrayBuffer());
  }
  return checkedImage(bytes);
}

/** Never hand back a broken file as a finished asset: check it's a real JPEG/PNG/WebP of a sensible size. */
function checkedImage(bytes: Buffer | null): ImageResult {
  if (!bytes || bytes.length < 5_000) throw new LlmError("invalid_output", "The image came back broken. Try again.");
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, contentType: "image/jpeg", extension: "jpg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, contentType: "image/png", extension: "png" };
  if (bytes.subarray(8, 12).toString() === "WEBP") return { bytes, contentType: "image/webp", extension: "webp" };
  throw new LlmError("invalid_output", "The image came back in a format Postory can't use. Try again.");
}

/** One image for a post: the images API when configured, otherwise Replicate. Downloaded so Postory can store it. */
export async function generateImageBytes(prompt: string, shape: ImageShape): Promise<ImageResult> {
  if (integrations.aiImage()) return imageViaApi(prompt, shape);
  return imageViaReplicate(prompt, shape);
}

/** Replicate's image model. */
async function imageViaReplicate(prompt: string, shape: ImageShape): Promise<ImageResult> {
  if (!integrations.replicate()) throw new LlmError("unavailable", "Image generation isn't set up on this deployment yet.");
  const output = await predict(
    env.replicateImageModel(),
    { prompt: prompt.slice(0, 2000), aspect_ratio: ASPECT[shape], output_format: "jpg", output_quality: 90, safety_tolerance: 2 },
    150_000,
  );
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new LlmError("invalid_output", "No image came back. Try again.");
  const file = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: "no-store" }).catch(() => null);
  if (!file?.ok) throw new LlmError("provider_error", "The image was made but couldn't be downloaded. Try again.");
  return checkedImage(Buffer.from(await file.arrayBuffer()));
}
