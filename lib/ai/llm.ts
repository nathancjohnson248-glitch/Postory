import "server-only";

import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { OWNER_EMAILS } from "@/lib/auth/admin";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/log";

/**
 * Postory's one door to its models, all server-side:
 *
 *   text    GitHub Models, OpenAI-compatible chat completions
 *           GITHUB_MODELS_BASE_URL  (default https://models.github.ai/inference)
 *           GITHUB_MODELS_TOKEN     a GitHub token with the models:read permission
 *           GITHUB_MODELS_MODEL     (default meta-llama-3-70b-instruct)
 *           GITHUB_MODELS_FAST_MODEL (quick checks; defaults to the same model)
 *   images  Replicate only: REPLICATE_API_TOKEN, REPLICATE_IMAGE_MODEL (FLUX 1.1 Pro)
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

export function llmProvider(): "github" | null {
  return integrations.githubModels() ? "github" : null;
}

export function imageAvailable() {
  return integrations.replicate();
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

// --- Text: GitHub Models ------------------------------------------------------------

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

/** POST {base}/chat/completions with the GitHub token. Returns the assistant's text. */
async function chatCompletion(model: string, system: string, turns: ChatTurn[], maxTokens: number): Promise<string> {
  const token = env.githubModelsToken();
  if (!token) throw new ConfigurationError("GITHUB_MODELS_TOKEN");
  const url = `${env.githubModelsBaseUrl()}/chat/completions`;

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
      log.warn("github models request failed", { operation: "ai.github", provider: "github", model, url, cause: String((error as { cause?: unknown }).cause ?? "") }, error);
      throw new LlmError("provider_error", `Postory's AI didn't respond. ${SAVED}`);
    }

    const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } };
    if (res.ok) {
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== "string") throw new LlmError("invalid_output", "Postory's AI returned nothing. Try again.");
      return text;
    }

    log.warn("github models error response", { operation: "ai.github", provider: "github", model, status: res.status, code: data.error?.code });
    if (res.status === 429) {
      // A per-minute limit clears quickly: wait it out once. A daily cap doesn't.
      const wait = Number(res.headers.get("retry-after")) || 0;
      if (attempt === 0 && wait > 0 && wait <= 20) {
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      if (wait > 20) {
        alertOwner("github-limit", {
          title: "GitHub Models rate limit reached",
          body: `GitHub Models is refusing requests for the next ${Math.round(wait / 60)} minutes. The free tier caps requests per day; turn on paid usage for GitHub Models in your GitHub billing settings to lift it.`,
          actionLabel: "GitHub billing",
          actionUrl: "https://github.com/settings/billing",
        });
      }
      throw new LlmError("provider_error", `Postory's AI is busy right now. ${SAVED}`);
    }
    if (res.status === 401 || res.status === 403) {
      alertOwner("github-token", {
        title: "GitHub Models rejected Postory's token",
        body: "Check GITHUB_MODELS_TOKEN in Railway: it must be a GitHub token with the models:read permission. Every AI request fails until it's fixed.",
        actionLabel: "Open Railway",
        actionUrl: "https://railway.com/dashboard",
      });
      throw new LlmError("unavailable", `Postory's AI couldn't respond just now. ${SAVED}`);
    }
    if (res.status === 404 || data.error?.code === "unknown_model") {
      alertOwner("github-model", {
        title: `GitHub Models can't find ${model}`,
        body: `Check GITHUB_MODELS_MODEL / GITHUB_MODELS_FAST_MODEL and GITHUB_MODELS_BASE_URL in Railway: "${model}" didn't resolve at ${env.githubModelsBaseUrl()}.`,
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
  if (!integrations.githubModels()) throw new LlmError("unavailable", "Postory's AI isn't set up on this deployment yet.");
  const fast = input.tier === "fast";
  const model = fast ? env.githubModelsFastModel() : env.githubModelsModel();
  const system = withSchema(input.system, input.schema);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await chatCompletion(model, system, input.turns, fast ? env.githubModelsMaxTokens() / 2 : env.githubModelsMaxTokens());
      const result = input.schema.safeParse(extractObject(text));
      if (!result.success) throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
      return result.data;
    } catch (error) {
      lastError = error;
      // A malformed answer is worth one more try; anything else goes back to the caller.
      if (!(error instanceof LlmError && error.code === "invalid_output")) throw error;
      log.warn("model output rejected, retrying", { operation: `ai.${input.name}`, provider: "github", model, attempt });
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
  return { ok: result.ok, model: env.githubModelsFastModel(), baseUrl: env.githubModelsBaseUrl(), ms: Date.now() - started };
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

/** One image for a post, from Replicate's image model, downloaded so Postory can store it. */
export async function generateImageBytes(prompt: string, shape: ImageShape): Promise<ImageResult> {
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
  const contentType = file.headers.get("content-type")?.split(";")[0] || "image/jpeg";
  return { bytes: Buffer.from(await file.arrayBuffer()), contentType, extension: contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg" };
}
