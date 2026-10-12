import "server-only";

/**
 * Nango — https://nango.dev/docs (HTTP API, base https://api.nango.dev).
 *
 * Nango holds each customer's OAuth tokens; Postory calls every network's own
 * API through Nango's proxy, which injects the token. Endpoints used:
 *   GET    /integrations                    which networks are set up
 *   POST   /connect/sessions                a hosted connect link (tags.end_user_id = Postory user)
 *   GET    /connections?tags[end_user_id]=  that user's connections only
 *   DELETE /connections/{id}?provider_config_key=
 *   ANY    /proxy/{path}                    the network's API, authenticated
 *
 * Nango does not publish or schedule; ./publishers.ts does the posting and
 * Postory's scheduler runs scheduled posts.
 */

import { ConfigurationError, env } from "@/lib/env";
import { log } from "@/lib/log";
import type { Platform } from "./platforms";
import { SocialProviderError } from "./types";

const BASE = "https://api.nango.dev";

/** Nango provider names Postory knows how to publish to. */
export const PROVIDER_PLATFORM: Record<string, Platform> = {
  "twitter-v2": "x",
  linkedin: "linkedin",
  threads: "threads",
  instagram: "instagram",
  pinterest: "pinterest",
  facebook: "facebook",
};

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; json?: unknown; headers?: Record<string, string>; timeoutMs?: number; body?: BodyInit };

async function call<T>(url: string, options: Options = {}): Promise<T> {
  return (await callWithHeaders<T>(url, options)).body;
}

async function callWithHeaders<T>(url: string, options: Options = {}): Promise<{ body: T; headers: Headers }> {
  const key = env.nangoSecretKey();
  if (!key) throw new ConfigurationError("NANGO_SECRET_KEY");
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json", ...options.headers };
  if (options.json !== undefined) headers["Content-Type"] = "application/json";
  const path = url.replace(BASE, "").split("?")[0];

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: options.body ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    log.warn("nango request failed", { operation: `${method} ${path}`, provider: "nango" }, error);
    throw new SocialProviderError(timedOut ? "timeout" : "network_error", "Couldn't reach the network. Try again.", { outcomeUnknown: method !== "GET", retryable: true });
  }
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (res.ok) return { body: body as T, headers: res.headers };

  const message = describe(body) ?? `The network returned HTTP ${res.status}.`;
  log.warn("nango error response", { operation: `${method} ${path}`, provider: "nango", status: res.status });
  throw new SocialProviderError(mapStatus(res.status), message, {
    status: res.status,
    retryable: res.status >= 500 || res.status === 429,
    outcomeUnknown: res.status >= 500 && method !== "GET",
  });
}

/** Pull a human message out of Nango's or a network's error body. */
function describe(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = (b.error && typeof b.error === "object" ? (b.error as Record<string, unknown>) : null) ?? null;
  const candidates = [nested?.message, b.message, b.detail, b.title, typeof b.error === "string" ? b.error : null, b.error_description];
  const found = candidates.find((c) => typeof c === "string" && c.trim());
  return typeof found === "string" ? found.slice(0, 300) : null;
}

function mapStatus(status: number) {
  if (status === 401) return "platform_auth_failed";
  if (status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 413) return "media_too_large";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "platform_rejected";
  if (status >= 500) return "platform_unavailable";
  return "platform_rejected";
}

// --- Integrations ---------------------------------------------------------------

type Integration = { unique_key: string; provider: string };
let integrationCache: { at: number; byPlatform: Map<Platform, string> } | null = null;

/** Which networks are set up in Nango, as platform → integration key. Cached for a minute. */
export async function configuredIntegrations(): Promise<Map<Platform, string>> {
  if (integrationCache && Date.now() - integrationCache.at < 60_000) return integrationCache.byPlatform;
  const res = await call<{ data?: Integration[] }>(`${BASE}/integrations`);
  const byPlatform = new Map<Platform, string>();
  for (const i of res.data ?? []) {
    const platform = PROVIDER_PLATFORM[i.provider];
    if (platform && !byPlatform.has(platform)) byPlatform.set(platform, i.unique_key);
  }
  integrationCache = { at: Date.now(), byPlatform };
  return byPlatform;
}

export async function availablePlatforms(): Promise<Platform[]> {
  try {
    return [...(await configuredIntegrations()).keys()];
  } catch {
    return [];
  }
}

// --- Connections ----------------------------------------------------------------

/**
 * POST /connect/sessions — a short-lived token for Nango's Connect UI (opened
 * in the browser with @nangohq/frontend), limited to one network and tagged
 * with the Postory user so the connection is theirs.
 */
export async function connectSessionToken(userId: string, platform: Platform) {
  const key = (await configuredIntegrations()).get(platform);
  if (!key) return null;
  const res = await call<{ data?: { token?: string } }>(`${BASE}/connect/sessions`, {
    method: "POST",
    json: { tags: { end_user_id: userId }, allowed_integrations: [key] },
  });
  const token = res.data?.token;
  if (!token) throw new SocialProviderError("unexpected_response", "Couldn't start the connection. Try again.");
  return token;
}

export type NangoConnection = { connectionId: string; providerConfigKey: string; provider: string; platform: Platform; created: string; broken: boolean };

/** GET /connections filtered to this Postory user. */
export async function listConnections(userId: string): Promise<NangoConnection[]> {
  const res = await call<{ connections?: { connection_id: string; provider_config_key: string; provider: string; created: string; errors?: unknown[] }[] }>(
    `${BASE}/connections?tags[end_user_id]=${encodeURIComponent(userId)}`,
  );
  return (res.connections ?? [])
    .map((c) => {
      const platform = PROVIDER_PLATFORM[c.provider];
      return platform
        ? { connectionId: c.connection_id, providerConfigKey: c.provider_config_key, provider: c.provider, platform, created: c.created, broken: Array.isArray(c.errors) && c.errors.length > 0 }
        : null;
    })
    .filter((c): c is NangoConnection => c !== null);
}

export async function deleteConnection(connectionId: string, providerConfigKey: string) {
  try {
    await call(`${BASE}/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(providerConfigKey)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof SocialProviderError && error.status === 404) return;
    throw error;
  }
}

// --- Proxy ----------------------------------------------------------------------

export type ProxyTarget = { connectionId: string; providerConfigKey: string };

/** Any call to the network's API, authenticated by Nango. `path` is relative to the provider's API base. */
export function proxy<T>(target: ProxyTarget, path: string, options: Options & { baseUrlOverride?: string } = {}) {
  const headers: Record<string, string> = {
    "Provider-Config-Key": target.providerConfigKey,
    "Connection-Id": target.connectionId,
    ...(options.baseUrlOverride ? { "Base-Url-Override": options.baseUrlOverride } : {}),
    ...options.headers,
  };
  return call<T>(`${BASE}/proxy${path.startsWith("/") ? path : `/${path}`}`, { ...options, headers, timeoutMs: options.timeoutMs ?? 60_000 });
}

/** Same as proxy(), with the response headers (LinkedIn returns the new post id in one). */
export function proxyWithHeaders<T>(target: ProxyTarget, path: string, options: Options = {}) {
  const headers: Record<string, string> = { "Provider-Config-Key": target.providerConfigKey, "Connection-Id": target.connectionId, ...options.headers };
  return callWithHeaders<T>(`${BASE}/proxy${path.startsWith("/") ? path : `/${path}`}`, { ...options, headers, timeoutMs: options.timeoutMs ?? 60_000 });
}

/** GET /connections/{id} — the live access token, for uploads that can't go through the proxy (LinkedIn's upload host). */
export async function accessToken(target: ProxyTarget) {
  const res = await call<{ credentials?: { access_token?: string } }>(
    `${BASE}/connections/${encodeURIComponent(target.connectionId)}?provider_config_key=${encodeURIComponent(target.providerConfigKey)}`,
  );
  const token = res.credentials?.access_token;
  if (!token) throw new SocialProviderError("platform_auth_failed", "This connection needs to be reconnected.");
  return token;
}

/** Account ids are stored as "<integration key>:<connection id>". */
export function packAccountId(t: ProxyTarget) {
  return `${t.providerConfigKey}:${t.connectionId}`;
}
export function unpackAccountId(id: string): ProxyTarget {
  const i = id.indexOf(":");
  return { providerConfigKey: id.slice(0, i), connectionId: id.slice(i + 1) };
}
