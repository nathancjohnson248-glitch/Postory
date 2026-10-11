import "server-only";

/**
 * LetMePost adapter — https://letmepost.dev (OpenAPI: api.letmepost.dev, v1).
 *
 * Every call here maps 1:1 to an operation in LetMePost's published OpenAPI
 * spec. Nothing outside lib/social/ talks to LetMePost directly; application
 * code goes through lib/social/service.ts.
 *
 * Auth: `Authorization: Bearer <LETMEPOST_API_KEY>`.
 * Idempotency: every write sends `Idempotency-Key`; LetMePost replays the
 * original response for 24h, so a retried request never posts twice.
 */

import { ConfigurationError, env } from "@/lib/env";
import { log } from "@/lib/log";
import { isPlatform, type Platform } from "./platforms";
import {
  SocialProviderError,
  type ConnectDescriptor,
  type ProviderAccount,
  type ProviderPost,
  type ProviderPostStatus,
  type PublishRequest,
  type PublishResult,
} from "./types";

const TO_LMP: Record<Platform, string> = {
  x: "twitter",
  linkedin: "linkedin",
  instagram: "instagram",
  threads: "threads",
  facebook: "facebook",
  bluesky: "bluesky",
  pinterest: "pinterest",
  tiktok: "tiktok",
};

export function toLetMePostPlatform(platform: Platform) {
  return TO_LMP[platform];
}

export function fromLetMePostPlatform(value: string): Platform | null {
  if (value === "twitter") return "x";
  return isPlatform(value) && value !== "x" ? value : null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  json?: unknown;
  form?: FormData;
  idempotencyKey?: string;
  timeoutMs?: number;
};

type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    rule?: string;
    remediation?: string;
    requestId?: string;
    platform?: string;
  };
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiKey = env.letmepostApiKey();
  if (!apiKey) throw new ConfigurationError("LETMEPOST_API_KEY");

  const method = options.method ?? "GET";
  const url = new URL(`${env.letmepostBaseUrl()}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) if (v) url.searchParams.set(k, v);

  const headers = new Headers({ Authorization: `Bearer ${apiKey}`, Accept: "application/json" });
  let body: BodyInit | undefined;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }
  if (method !== "GET") headers.set("Idempotency-Key", options.idempotencyKey ?? crypto.randomUUID());

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    log.warn("letmepost request failed", { operation: `${method} ${path}`, provider: "letmepost" }, error);
    throw new SocialProviderError(
      timedOut ? "timeout" : "network_error",
      timedOut ? "LetMePost didn't respond in time." : "Couldn't reach LetMePost.",
      { outcomeUnknown: method !== "GET", retryable: true },
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const envelope = (payload as ErrorEnvelope | null)?.error;
    const code = envelope?.code ?? (response.status >= 500 ? "platform_unavailable" : "unknown_error");
    const err = new SocialProviderError(code, envelope?.message ?? `LetMePost returned HTTP ${response.status}.`, {
      status: response.status,
      rule: envelope?.rule,
      remediation: envelope?.remediation,
      requestId: envelope?.requestId ?? response.headers.get("x-request-id") ?? undefined,
      platform: envelope?.platform,
      outcomeUnknown: method !== "GET" && response.status >= 500,
      retryable: response.status === 429 || response.status >= 500,
    });
    log.warn("letmepost error response", {
      operation: `${method} ${path}`,
      provider: "letmepost",
      status: response.status,
      code,
      rule: envelope?.rule,
      requestId: err.options.requestId,
    });
    throw err;
  }

  return payload as T;
}

// --- Accounts ---------------------------------------------------------------

type LmpAccount = {
  id: string;
  profileId: string;
  platform: string;
  platformAccountId: string;
  displayName: string | null;
  tokenExpiresAt?: string | null;
  pinterest?: Record<string, unknown>;
  instagram?: Record<string, unknown>;
};

function mapAccount(a: LmpAccount): ProviderAccount | null {
  const platform = fromLetMePostPlatform(a.platform);
  if (!platform) return null;
  return {
    externalId: a.id,
    platform,
    displayName: a.displayName,
    externalProfileId: a.profileId ?? null,
    platformAccountId: a.platformAccountId,
    tokenExpiresAt: a.tokenExpiresAt ?? null,
    metadata: { ...(a.pinterest ? { pinterest: a.pinterest } : {}), ...(a.instagram ? { instagram: a.instagram } : {}) },
  };
}

/** GET /v1/accounts — accounts in the org, optionally narrowed to one profile. */
export async function listAccounts(profileId?: string | null): Promise<ProviderAccount[]> {
  const res = await request<{ data: LmpAccount[] }>("/v1/accounts", { query: { profileId: profileId ?? undefined } });
  return (res.data ?? []).map(mapAccount).filter((a): a is ProviderAccount => a !== null);
}

/** GET /v1/accounts/{id} */
export async function getAccount(id: string): Promise<ProviderAccount | null> {
  try {
    return mapAccount(await request<LmpAccount>(`/v1/accounts/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof SocialProviderError && error.status === 404) return null;
    throw error;
  }
}

/**
 * POST /v1/accounts/connect/{platform} — returns an OAuth authorization URL
 * (or a credentials form for Bluesky). `returnTo` is where LetMePost sends the
 * browser after the network's consent screen.
 */
export async function startConnect(
  platform: Platform,
  input: { profileId?: string | null; returnTo: string },
): Promise<ConnectDescriptor> {
  const res = await request<{
    platform: string;
    state: "stable" | "trial" | "pending";
    descriptor: { kind?: string; authorizationUrl?: string; fields?: { name: string; label?: string; type?: string }[] };
  }>(`/v1/accounts/connect/${toLetMePostPlatform(platform)}`, {
    method: "POST",
    json: { ...(input.profileId ? { profileId: input.profileId } : {}), returnTo: input.returnTo },
  });

  const d = res.descriptor ?? {};
  if (d.kind === "oauth" && d.authorizationUrl) {
    return { kind: "redirect", url: d.authorizationUrl, availability: res.state };
  }
  if (d.kind === "credentials") {
    return {
      kind: "credentials",
      availability: res.state,
      fields: (d.fields ?? [
        { name: "identifier", label: "Handle" },
        { name: "appPassword", label: "App password", type: "password" },
      ]).map((f) => ({ name: f.name, label: f.label ?? f.name, type: f.type ?? "text" })),
    };
  }
  throw new SocialProviderError("unexpected_response", "LetMePost returned a connect response Postory doesn't recognise.");
}

/** POST /v1/accounts/connect/{platform}/complete — credentials platforms (Bluesky). */
export async function completeCredentialsConnect(
  platform: Platform,
  input: { profileId?: string | null; fields: Record<string, string> },
): Promise<ProviderAccount | null> {
  const res = await request<LmpAccount>(`/v1/accounts/connect/${toLetMePostPlatform(platform)}/complete`, {
    method: "POST",
    json: { ...input.fields, ...(input.profileId ? { profileId: input.profileId } : {}) },
  });
  return mapAccount(res);
}

/** DELETE /v1/accounts/{id} */
export async function disconnectAccount(id: string): Promise<void> {
  await request(`/v1/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- Media ------------------------------------------------------------------

/** POST /v1/media (multipart, single `file` part). Returns a `med_…` id. */
export async function uploadMedia(input: { bytes: ArrayBuffer; filename: string; contentType: string; profileId?: string | null }) {
  const form = new FormData();
  form.append("file", new Blob([input.bytes], { type: input.contentType }), input.filename);
  const res = await request<{ id: string; url: string; contentType: string }>("/v1/media", {
    method: "POST",
    form,
    query: { profileId: input.profileId ?? undefined },
    timeoutMs: 120_000,
  });
  return { mediaId: res.id, url: res.url };
}

// --- Posts ------------------------------------------------------------------

type LmpTargetResult = {
  accountId: string;
  platform: string;
  postId?: string;
  status: ProviderPostStatus;
  uri?: string;
  warnings?: { code: string; message: string }[];
  error?: { code: string; message: string; rule?: string; remediation?: string };
};

/**
 * POST /v1/posts — publish now, or queue for `scheduledAt`.
 * One Postory post == one target, so per-target outcomes map directly.
 */
export async function createPost(input: PublishRequest): Promise<PublishResult> {
  const target = {
    accountId: input.accountExternalId,
    platform: toLetMePostPlatform(input.platform),
    text: input.text,
    ...(input.media.length
      ? { media: input.media.map((m) => ({ kind: m.kind, mediaId: m.mediaId, ...(m.altText ? { altText: m.altText } : {}) })) }
      : {}),
  };

  const res = await request<{ id: string; status: string; results: LmpTargetResult[] }>("/v1/posts", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    timeoutMs: 120_000,
    json: {
      targets: [target],
      ...(input.scheduledAt ? { scheduledAt: input.scheduledAt.toISOString() } : { publishNow: true }),
      ...(input.externalProfileId ? { profileId: input.externalProfileId } : {}),
    },
  });

  const result = res.results?.[0];
  if (!result) throw new SocialProviderError("unexpected_response", "LetMePost returned no result for this post.");
  return {
    status: result.status,
    externalPostId: result.postId ?? null,
    batchId: res.id ?? null,
    uri: result.uri ?? null,
    warnings: (result.warnings ?? []).map((w) => w.message),
    error: result.error ? { code: result.error.code, message: result.error.message, remediation: result.error.remediation, rule: result.error.rule } : null,
  };
}

type LmpPost = {
  id: string;
  status: ProviderPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  platformUri: string | null;
  error?: unknown;
};

function mapPost(p: LmpPost): ProviderPost {
  const e = p.error as { code?: string; message?: string } | null | undefined;
  return {
    externalPostId: p.id,
    status: p.status,
    scheduledAt: p.scheduledAt,
    publishedAt: p.publishedAt,
    uri: p.platformUri,
    error: e && (e.code || e.message) ? { code: e.code ?? "failed", message: e.message ?? "The network rejected this post." } : null,
  };
}

/** GET /v1/posts/{id} */
export async function getPost(id: string): Promise<ProviderPost> {
  return mapPost(await request<LmpPost>(`/v1/posts/${encodeURIComponent(id)}`));
}

/** PATCH /v1/posts/{id} — move a queued post. 409 once it has started publishing. */
export async function reschedulePost(id: string, scheduledAt: Date): Promise<ProviderPost> {
  return mapPost(
    await request<LmpPost>(`/v1/posts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      json: { scheduledAt: scheduledAt.toISOString() },
    }),
  );
}

/** DELETE /v1/posts/{id} — cancel a queued post before it fires. */
export async function cancelPost(id: string): Promise<void> {
  await request(`/v1/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
