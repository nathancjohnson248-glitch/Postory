import "server-only";

import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { OWNER_EMAILS } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/log";

/**
 * Postory's one door to its models, all server-side:
 *
 *   text   SambaNova (SAMBANOVA_MODEL / SAMBANOVA_FAST_MODEL) first, then
 *          Replicate (REPLICATE_TEXT_MODEL / REPLICATE_FAST_MODEL) if SambaNova
 *          is busy or refuses
 *   images Replicate (REPLICATE_IMAGE_MODEL, default FLUX 1.1 Pro)
 *
 * Every call puts the JSON Schema in the instructions, extracts the object
 * from the answer, and validates it with zod. A malformed answer is retried
 * once; model output is never trusted as-is, and callers validate again.
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

export function llmProvider(): "sambanova" | "replicate" | null {
  return integrations.sambanova() ? "sambanova" : integrations.replicate() ? "replicate" : null;
}

export function imageAvailable() {
  return integrations.replicate();
}

/** JSON Schema for the instructions, from the zod model schema. */
function jsonSchemaFor(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { target: "draft-7", io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

// --- Replicate ------------------------------------------------------------------

let lastAlert = 0;

/** Email the owner (at most every six hours) when Replicate refuses Postory's account. */
function alertOwner(reason: "credit" | "token" | "model", model: string) {
  if (Date.now() - lastAlert < 6 * 3_600_000) return;
  lastAlert = Date.now();
  log.error("replicate refused the account", { operation: "ai.replicate.account", provider: "replicate", reason, model });
  void sendEmail(OWNER_EMAILS[0], "ownerAlert", {
    title: reason === "credit" ? "Replicate is out of credit" : reason === "token" ? "Replicate rejected Postory's token" : `Replicate can't find ${model}`,
    body:
      reason === "credit"
        ? "Every AI request (writing posts, the assistant, images) is failing until credit is added. Add credit at replicate.com/account/billing; Postory recovers by itself as soon as it's there."
        : reason === "token"
          ? "Check REPLICATE_API_TOKEN in Railway. Every AI request fails until it's fixed."
          : `Check REPLICATE_TEXT_MODEL / REPLICATE_FAST_MODEL / REPLICATE_IMAGE_MODEL in Railway: "${model}" didn't resolve.`,
    actionLabel: reason === "credit" ? "Add Replicate credit" : "Open Railway",
    actionUrl: reason === "credit" ? "https://replicate.com/account/billing" : "https://railway.com/dashboard",
  }).catch(() => undefined);
}

type Prediction = { id?: string; status?: string; output?: unknown; error?: unknown; urls?: { get?: string } };

/**
 * POST /v1/models/{owner}/{name}/predictions with "Prefer: wait" (Replicate
 * holds the request up to 60s); anything still running is polled until done
 * or the deadline passes. https://replicate.com/docs/reference/http
 */
async function predict(model: string, input: Record<string, unknown>, timeoutMs: number, what: "text" | "image"): Promise<unknown> {
  const token = env.replicateApiToken();
  if (!token) throw new ConfigurationError("REPLICATE_API_TOKEN");
  const noun = what === "text" ? "Postory's AI" : "Image generation";
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
    log.warn("replicate request failed", { operation: `ai.replicate.${what}`, provider: "replicate", model }, error);
    throw new LlmError("provider_error", `${noun} didn't respond. Nothing was lost, so try again.`);
  }

  let prediction = (await res.json().catch(() => ({}))) as Prediction;
  if (!res.ok) {
    log.warn("replicate error response", { operation: `ai.replicate.${what}`, provider: "replicate", model, status: res.status });
    // Account problems (no credit, bad token, wrong model) are ours to fix, not
    // the customer's: tell the owner, and give the customer a plain message.
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 404) {
      alertOwner(res.status === 402 ? "credit" : res.status === 404 ? "model" : "token", model);
      throw new LlmError("unavailable", `${noun} couldn't respond just now. Anything you wrote is saved, so try again in a few minutes.`);
    }
    if (res.status === 422) throw new LlmError("provider_error", `${noun} couldn't take that request. Try rewording it.`);
    if (res.status === 429) throw new LlmError("provider_error", `${noun} is busy. Try again in a minute.`);
    throw new LlmError("provider_error", `${noun} hit a problem. Nothing was lost, so try again.`);
  }

  while (prediction.status === "starting" || prediction.status === "processing") {
    if (Date.now() > deadline || !prediction.urls?.get) {
      // Don't leave a long job running (and billing) after we've given up on it.
      if (prediction.id) void fetch(`https://api.replicate.com/v1/predictions/${prediction.id}/cancel`, { method: "POST", headers }).catch(() => undefined);
      throw new LlmError("provider_error", `${noun} took too long. Try again.`);
    }
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(prediction.urls.get, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (poll?.ok) prediction = (await poll.json().catch(() => prediction)) as Prediction;
  }

  if (prediction.status !== "succeeded") {
    const detail = typeof prediction.error === "string" ? prediction.error : "";
    log.warn("replicate prediction failed", { operation: `ai.replicate.${what}`, provider: "replicate", model, status: prediction.status, detail: detail.slice(0, 200) });
    // Image models refuse unsafe prompts with an NSFW / safety error.
    if (/nsfw|safety|flagged|sensitive/i.test(detail)) throw new LlmError("refused", "That image request was declined by the model's safety filter. Try a different description.");
    throw new LlmError("provider_error", `${noun} hit a problem. Nothing was lost, so try again.`);
  }
  return prediction.output;
}

// --- Text -----------------------------------------------------------------------

type StructuredInput<S extends z.ZodType> = {
  system: string;
  turns: ChatTurn[];
  schema: S;
  name: string;
  /** "fast" for quick checks where a smaller model is enough. */
  tier?: "best" | "fast";
};

/** Pull the JSON object out of the answer, tolerating a stray fence or preamble. */
function extractObject(output: unknown): unknown {
  const text = Array.isArray(output) ? output.join("") : typeof output === "string" ? output : "";
  if (!text.trim()) throw new LlmError("invalid_output", "Postory's AI returned nothing. Try again.");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text);
  } catch {
    throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
  }
}

// --- SambaNova (text) ---------------------------------------------------------

/** Providers that refused Postory's account recently (no access, no credit), and until when to skip them. */
const benched = new Map<string, number>();

/**
 * SambaNova Cloud's OpenAI-compatible chat API (https://docs.sambanova.ai).
 * JSON mode keeps the answer parseable; the schema itself goes in the system
 * prompt, and the result is validated like every other provider's.
 */
async function sambanova(model: string, system: string, turns: ChatTurn[], maxTokens: number): Promise<string> {
  const key = env.sambanovaApiKey();
  if (!key) throw new ConfigurationError("SAMBANOVA_API_KEY");
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, ...turns.map((t) => ({ role: t.role, content: t.content }))],
          max_tokens: maxTokens,
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(120_000),
        cache: "no-store",
      });
    } catch (error) {
      log.warn("sambanova request failed", { operation: "ai.sambanova", provider: "sambanova", model }, error);
      throw new LlmError("provider_error", "Postory's AI didn't respond. Nothing was lost, so try again.");
    }
    const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    if (res.ok) return data.choices?.[0]?.message?.content ?? "";
    log.warn("sambanova error response", { operation: "ai.sambanova", provider: "sambanova", model, status: res.status });
    // Rate limits are short: wait out one, then let the next provider take it.
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get("retry-after")) || 3, 8);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 404) throw new LlmError("unavailable", "Postory's AI couldn't respond just now. Anything you wrote is saved, so try again in a few minutes.");
    throw new LlmError("provider_error", "Postory's AI is busy. Nothing was lost, so try again in a minute.");
  }
}

function withSchema(system: string, schema: z.ZodType) {
  return `${system}\n\nRespond with only one JSON object that matches this JSON Schema. No prose, no code fences.\n${JSON.stringify(jsonSchemaFor(schema))}`;
}

type TextProvider = "sambanova" | "replicate";

function textProviders(): TextProvider[] {
  const all: TextProvider[] = [];
  if (integrations.sambanova()) all.push("sambanova");
  if (integrations.replicate()) all.push("replicate");
  const ready = all.filter((p) => (benched.get(p) ?? 0) < Date.now());
  return ready.length ? ready : all;
}

async function askOnce(provider: TextProvider, input: StructuredInput<z.ZodType>): Promise<unknown> {
  const system = withSchema(input.system, input.schema);
  if (provider === "sambanova") {
    const model = input.tier === "fast" ? env.sambanovaFastModel() : env.sambanovaModel();
    return extractObject(await sambanova(model, system, input.turns, input.tier === "fast" ? 2048 : 6000));
  }
  const model = input.tier === "fast" ? env.replicateFastModel() : env.replicateTextModel();
  const prompt =
    input.turns.length === 1 ? input.turns[0].content : input.turns.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n");
  return extractObject(await predict(model, { system_prompt: system, prompt, max_tokens: input.tier === "fast" ? 2048 : 6000 }, 150_000, "text"));
}

/**
 * One structured call: a system prompt, the conversation (or a single user
 * message), and the schema the answer must follow. SambaNova answers first;
 * Replicate takes over if SambaNova is busy or refuses. A malformed answer is
 * retried once. Returns the parsed object (callers still apply their own
 * validated schema with length limits).
 */
export async function generateStructured<S extends z.ZodType>(input: StructuredInput<S>): Promise<z.infer<S>> {
  const providers = textProviders();
  if (!providers.length) throw new LlmError("unavailable", "Postory's AI isn't set up on this deployment yet.");

  let lastError: unknown = null;
  for (const provider of providers) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = input.schema.safeParse(await askOnce(provider, input));
        if (!result.success) throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
        benched.delete(provider);
        return result.data;
      } catch (error) {
        lastError = error;
        if (error instanceof LlmError && error.code === "invalid_output" && attempt === 0) {
          log.warn("model output rejected, retrying", { operation: `ai.${input.name}`, provider, attempt });
          continue;
        }
        if (error instanceof LlmError && error.code === "unavailable") benched.set(provider, Date.now() + 10 * 60_000);
        // Busy, refused or still malformed: hand over to the next provider.
        if (error instanceof LlmError || error instanceof ConfigurationError) break;
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new LlmError("provider_error", "Postory's AI hit a problem. Try again.");
}

// --- Images ---------------------------------------------------------------------

export type ImageShape = "square" | "portrait" | "landscape";
type ImageResult = { bytes: Buffer; contentType: string; extension: string };

const ASPECT: Record<ImageShape, string> = { square: "1:1", portrait: "4:5", landscape: "16:9" };

/** One image for a post, from Replicate's image model, downloaded so Postory can store it. */
export async function generateImageBytes(prompt: string, shape: ImageShape): Promise<ImageResult> {
  if (!integrations.replicate()) throw new LlmError("unavailable", "Image generation isn't set up on this deployment yet.");
  const output = await predict(
    env.replicateImageModel(),
    { prompt: prompt.slice(0, 2000), aspect_ratio: ASPECT[shape], output_format: "jpg", output_quality: 90, safety_tolerance: 2 },
    150_000,
    "image",
  );
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new LlmError("invalid_output", "No image came back. Try again.");
  const file = await fetch(url, { signal: AbortSignal.timeout(60_000), cache: "no-store" }).catch(() => null);
  if (!file?.ok) throw new LlmError("provider_error", "The image was made but couldn't be downloaded. Try again.");
  const contentType = file.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { bytes: Buffer.from(await file.arrayBuffer()), contentType, extension: contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg" };
}
