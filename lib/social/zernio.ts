import "server-only";

/**
 * Zernio — https://zernio.com/llms.txt (REST, base https://zernio.com/api/v1).
 *
 * Zernio holds the OAuth apps and tokens for X, LinkedIn, Instagram, Threads,
 * Facebook and Pinterest, so customers connect with the network's own consent
 * screen and Postory never sees a token. Multi-tenant: one Zernio profile per
 * Postory user, tagged with externalId = the Postory user id.
 *
 * Endpoints used:
 *   GET    /profiles?externalId=        find a user's profile
 *   POST   /profiles                    create it ({ name, externalId })
 *   GET    /connect/{platform}          hosted OAuth link (profileId, redirect_url)
 *   GET    /accounts?profileId=         that profile's accounts only
 *   DELETE /accounts/{id}               disconnect (and stop paying for it)
 *   POST   /posts                       publishNow, with an Idempotency-Key
 *   GET    /analytics?postId=           per-post metrics
 *   GET    /inbox/comments/{postId}     comments (accountId)
 *   POST   /inbox/comments/{postId}     reply (accountId, message, commentId)
 *
 * The API key never leaves the server. Every call is scoped by a profile or
 * account id that Postory looked up from its own database for the signed-in
 * user, never by anything the browser sent.
 */

import { ConfigurationError, env } from "@/lib/env";
import { log } from "@/lib/log";
import type { Platform } from "./platforms";
import { SocialProviderError, type PostMetrics, type ProviderAccount, type RemoteComment } from "./types";

const BASE = "https://zernio.com/api/v1";

/** Postory platform → Zernio platform name. */
export const ZERNIO_PLATFORM: Partial<Record<Platform, string>> = {
  x: "twitter",
  linkedin: "linkedin",
  instagram: "instagram",
  threads: "threads",
  facebook: "facebook",
  pinterest: "pinterest",
};
const FROM_ZERNIO = Object.fromEntries(Object.entries(ZERNIO_PLATFORM).map(([k, v]) => [v, k])) as Record<string, Platform>;

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; json?: unknown; headers?: Record<string, string>; timeoutMs?: number };

type Raw = { status: number; body: unknown };

async function request(path: string, options: Options = {}): Promise<Raw> {
  const key = env.zernioApiKey();
  if (!key) throw new ConfigurationError("ZERNIO_API_KEY");
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json", ...options.headers };
  if (options.json !== undefined) headers["Content-Type"] = "application/json";
  const operation = `${method} ${path.split("?")[0].replace(/[a-f0-9]{24}/g, ":id")}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    log.warn("zernio request failed", { operation, provider: "zernio" }, error);
    throw new SocialProviderError(timedOut ? "timeout" : "network_error", "Couldn't reach the network. Try again.", { outcomeUnknown: method !== "GET", retryable: true });
  }
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text.slice(0, 300) };
  }
  if (res.ok) return { status: res.status, body };

  const message = describe(body) ?? `The network returned HTTP ${res.status}.`;
  log.warn("zernio error response", { operation, provider: "zernio", status: res.status, code: errorCode(body) });
  // 401 here means Postory's own key was refused, not the customer's account.
  if (res.status === 401) throw new SocialProviderError("provider_unavailable", "Postory's connection service isn't accepting requests right now. Try again soon.", { status: 401 });
  throw new SocialProviderError(mapStatus(res.status), message, {
    status: res.status,
    retryable: res.status >= 500 || res.status === 429,
    outcomeUnknown: res.status >= 500 && method !== "GET",
  });
}

async function call<T>(path: string, options: Options = {}): Promise<T> {
  return (await request(path, options)).body as T;
}

function errorCode(body: unknown): string | undefined {
  const b = body as { code?: unknown; error?: unknown } | null;
  const c = b?.code ?? (b?.error && typeof b.error === "object" ? (b.error as { code?: unknown }).code : undefined);
  return typeof c === "string" ? c.slice(0, 60) : undefined;
}

function describe(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const nested = b.error && typeof b.error === "object" ? (b.error as Record<string, unknown>) : null;
  const found = [nested?.message, b.message, b.details, typeof b.error === "string" ? b.error : null].find((c) => typeof c === "string" && c.trim());
  return typeof found === "string" ? found.slice(0, 300) : null;
}

function mapStatus(status: number) {
  if (status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 413) return "media_too_large";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "platform_unavailable";
  return "platform_rejected";
}

// --- Profiles ---------------------------------------------------------------------

type ZProfile = { _id: string; externalId?: string | null };
const profileCache = new Map<string, string>();

/** The user's Zernio profile id, created on first use. */
export async function profileFor(userId: string, create = true): Promise<string | null> {
  const cached = profileCache.get(userId);
  if (cached) return cached;
  const found = await call<{ profiles?: ZProfile[] }>(`/profiles?externalId=${encodeURIComponent(userId)}`);
  let id = found.profiles?.find((p) => p.externalId === userId)?._id ?? null;
  if (!id && create) {
    try {
      const made = await call<{ profile?: ZProfile }>("/profiles", { method: "POST", json: { name: `Postory ${userId.slice(0, 8)}`, externalId: userId } });
      id = made.profile?._id ?? null;
    } catch (error) {
      // Two tabs raced to create it: use the one that won.
      if (!(error instanceof SocialProviderError && error.status === 409)) throw error;
      const again = await call<{ profiles?: ZProfile[] }>(`/profiles?externalId=${encodeURIComponent(userId)}`);
      id = again.profiles?.find((p) => p.externalId === userId)?._id ?? null;
    }
    if (!id) throw new SocialProviderError("unexpected_response", "The connection service didn't create a workspace.");
  }
  if (id) {
    if (profileCache.size > 5000) profileCache.clear();
    profileCache.set(userId, id);
  }
  return id;
}

// --- Connecting ---------------------------------------------------------------------

/** A link to the network's own consent screen. Zernio sends the browser back to `redirectUrl` afterwards. */
export async function connectUrl(profileId: string, platform: Platform, redirectUrl: string, reconnectAccountId?: string) {
  const name = ZERNIO_PLATFORM[platform];
  if (!name) throw new SocialProviderError("platform_not_enabled", "This network isn't available yet.");
  const q = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  if (reconnectAccountId) q.set("reconnectAccountId", reconnectAccountId);
  const r = await call<{ authUrl?: string }>(`/connect/${name}?${q}`);
  if (!r.authUrl || !/^https:\/\//.test(r.authUrl)) throw new SocialProviderError("unexpected_response", "The network didn't return a sign-in link.");
  return r.authUrl;
}

type ZAccount = {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  platformUserId?: string;
  profilePicture?: string | null;
  profileUrl?: string;
  isActive?: boolean;
  needsReconnection?: boolean;
  enabled?: boolean;
};

/** Every social account on the user's profile that Postory can post to. */
export async function listAccounts(profileId: string): Promise<ProviderAccount[]> {
  const r = await call<{ accounts?: ZAccount[] }>(`/accounts?profileId=${encodeURIComponent(profileId)}&category=social`);
  return (r.accounts ?? [])
    .filter((a) => FROM_ZERNIO[a.platform])
    .map((a) => ({
      externalId: a._id,
      platform: FROM_ZERNIO[a.platform],
      displayName: a.displayName ?? a.username ?? null,
      platformAccountId: a.platformUserId ?? a._id,
      needsReconnect: a.needsReconnection === true || a.isActive === false,
      metadata: {
        name: a.displayName ?? null,
        // LinkedIn and Facebook pages have no @handle; Zernio puts the name there.
        username: a.username && /^@?[\w.]+$/.test(a.username) ? a.username : null,
        picture: a.profilePicture ?? null,
        profileUrl: a.profileUrl ?? null,
      },
    }));
}

export async function disconnect(accountId: string) {
  await call(`/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}

// --- Publishing ---------------------------------------------------------------------

type ZPlatformResult = {
  status?: string;
  platformPostId?: string;
  platformPostUrl?: string | null;
  errorMessage?: string;
  errorCategory?: string;
};

const CATEGORY_CODE: Record<string, string> = {
  auth_expired: "platform_auth_failed",
  account_issue: "platform_auth_failed",
  user_content: "platform_rejected",
  user_abuse: "platform_rejected",
  platform_rejected: "platform_rejected",
  platform_rate_limit: "rate_limited",
  quota_exhausted: "rate_limited",
  platform_error: "platform_unavailable",
  system_error: "platform_unavailable",
};

/**
 * Publish one post now. The Idempotency-Key makes a retry of the same attempt
 * (timeout, dropped connection) return the original post instead of posting
 * twice. Returns Zernio's post id too: metrics and comments are read by it.
 */
export async function publish(input: { accountId: string; platform: Platform; text: string; imageUrl: string | null; idempotencyKey: string }) {
  const name = ZERNIO_PLATFORM[input.platform];
  if (!name) throw new SocialProviderError("platform_not_enabled", "This network isn't available yet.");
  const r = await call<{ post?: { _id?: string; status?: string; platforms?: ZPlatformResult[] } }>("/posts", {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    timeoutMs: 120_000,
    json: {
      content: input.text,
      publishNow: true,
      platforms: [{ platform: name, accountId: input.accountId }],
      ...(input.imageUrl ? { mediaItems: [{ type: "image", url: input.imageUrl }] } : {}),
    },
  });
  const post = r.post;
  const result = post?.platforms?.[0];
  if (!post?._id || !result) throw new SocialProviderError("unexpected_response", "The network's answer was missing the post.", { outcomeUnknown: true });
  if (result.status === "published" && result.platformPostId) {
    return { postId: result.platformPostId, url: result.platformPostUrl ?? null, providerPostId: post._id };
  }
  if (result.status === "failed" || post.status === "failed") {
    const code = CATEGORY_CODE[result.errorCategory ?? ""] ?? "platform_rejected";
    throw new SocialProviderError(code, (result.errorMessage ?? "The network rejected this post.").slice(0, 300), { retryable: code === "rate_limited" || code === "platform_unavailable" });
  }
  // Still publishing, or a status we don't know: never claim it went out.
  throw new SocialProviderError("unexpected_response", "The network hasn't confirmed this post yet.", { outcomeUnknown: true });
}

// --- Reading back ---------------------------------------------------------------------

type ZAnalytics = { impressions?: number; reach?: number; likes?: number; comments?: number; shares?: number; reposts?: number };

/** Engagement for one Zernio post. null while the network hasn't synced it yet. */
export async function metrics(providerPostId: string): Promise<PostMetrics | null> {
  const r = await request(`/analytics?postId=${encodeURIComponent(providerPostId)}`);
  if (r.status === 202) return null;
  const a = (r.body as { analytics?: ZAnalytics }).analytics;
  if (!a) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return { impressions: n(a.impressions), reach: n(a.reach), reactions: n(a.likes), comments: n(a.comments), reposts: n(a.shares) ?? n(a.reposts) };
}

type ZComment = { id: string; message?: string; createdTime?: string; url?: string | null; from?: { name?: string; username?: string; isOwner?: boolean } };

export async function comments(providerPostId: string, accountId: string): Promise<RemoteComment[]> {
  const r = await call<{ comments?: ZComment[] }>(`/inbox/comments/${encodeURIComponent(providerPostId)}?accountId=${encodeURIComponent(accountId)}&limit=50`);
  return (r.comments ?? [])
    .filter((c) => c.id && c.message && !c.from?.isOwner)
    .map((c) => ({
      id: c.id,
      authorName: c.from?.name ?? null,
      authorHandle: c.from?.username ? `@${c.from.username.replace(/^@/, "")}` : null,
      text: c.message!,
      createdAt: c.createdTime ?? new Date().toISOString(),
      url: c.url && /^https:\/\//.test(c.url) ? c.url : null,
      context: { providerPostId },
    }));
}

/** Reply to a comment. The key makes a retried send land once. */
export async function reply(input: { providerPostId: string; accountId: string; commentId: string; text: string; idempotencyKey: string }) {
  const r = await call<{ success?: boolean }>(`/inbox/comments/${encodeURIComponent(input.providerPostId)}`, {
    method: "POST",
    headers: { "Idempotency-Key": input.idempotencyKey },
    json: { accountId: input.accountId, message: input.text, commentId: input.commentId },
  });
  if (r.success === false) throw new SocialProviderError("platform_rejected", "The network didn't accept the reply.");
}
