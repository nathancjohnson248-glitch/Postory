import "server-only";

import { z } from "zod";
import { ConfigurationError, env, integrations } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Postory's one door to its models. Everything runs on Replicate with one
 * server-side token (REPLICATE_API_TOKEN):
 *
 *   text   REPLICATE_TEXT_MODEL   (default anthropic/claude-4.5-sonnet)
 *          REPLICATE_FAST_MODEL   (default anthropic/claude-4.5-haiku), quick checks
 *   images REPLICATE_IMAGE_MODEL  (default black-forest-labs/flux-1.1-pro)
 *
 * Replicate's language models take a plain prompt and system prompt, so every
 * call puts the JSON Schema in the instructions, extracts the object from the
 * answer, and validates it with zod. A malformed answer is retried once; model
 * output is never trusted as-is, and callers validate again with their limits.
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

export function llmProvider(): "replicate" | null {
  return integrations.replicate() ? "replicate" : null;
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
    if (res.status === 401 || res.status === 403) throw new LlmError("unavailable", `${noun} isn't available right now. The owner has been told; try again later.`);
    if (res.status === 402) throw new LlmError("unavailable", `${noun} is paused while Postory tops up its model credit. Try again later.`);
    if (res.status === 404) throw new LlmError("unavailable", `${noun} isn't set up correctly on this deployment.`);
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

/**
 * One structured call: a system prompt, the conversation (or a single user
 * message), and the schema the answer must follow. Returns the parsed object
 * (callers still apply their own validated schema with length limits).
 */
export async function generateStructured<S extends z.ZodType>(input: StructuredInput<S>): Promise<z.infer<S>> {
  if (!integrations.replicate()) throw new LlmError("unavailable", "Postory's AI isn't set up on this deployment yet.");
  const model = input.tier === "fast" ? env.replicateFastModel() : env.replicateTextModel();
  const prompt =
    input.turns.length === 1 ? input.turns[0].content : input.turns.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n");
  const body = {
    system_prompt: `${input.system}\n\nRespond with only one JSON object that matches this JSON Schema. No prose, no code fences.\n${JSON.stringify(jsonSchemaFor(input.schema))}`,
    prompt,
    max_tokens: input.tier === "fast" ? 2048 : 6000,
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = extractObject(await predict(model, body, 150_000, "text"));
      const result = input.schema.safeParse(parsed);
      if (!result.success) throw new LlmError("invalid_output", "Postory's AI returned something it couldn't use. Try again.");
      return result.data;
    } catch (error) {
      lastError = error;
      // A malformed answer is worth one more try; anything else goes back to the caller.
      if (!(error instanceof LlmError && error.code === "invalid_output")) throw error;
      log.warn("model output rejected, retrying", { operation: `ai.${input.name}`, provider: "replicate", model, attempt });
    }
  }
  throw lastError;
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
