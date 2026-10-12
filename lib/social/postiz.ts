import "server-only";

/**
 * Postiz adapter — https://docs.postiz.com/public-api (Postiz Cloud, or a
 * self-hosted instance via POSTIZ_API_URL; the API is the same).
 *
 * Every call maps to a documented Public API endpoint:
 *   GET    /integrations            channels in the workspace
 *   GET    /social/{provider}       OAuth URL to connect a channel
 *   DELETE /integrations/{id}       remove a channel
 *   POST   /upload-from-url         import media from a URL
 *   POST   /posts                   publish now / schedule
 *   GET    /posts?startDate&endDate post state (QUEUE/PUBLISHED/ERROR/DRAFT)
 *   DELETE /posts/{id}              delete a post (and its group)
 *
 * Postiz keeps every channel in one workspace, so Postory records which
 * channel belongs to which customer (see the service's shared-workspace path).
 * Auth is the raw API key in `Authorization` (no "Bearer").
 */

import { ConfigurationError, env } from "@/lib/env";
import { log } from "@/lib/log";
import type { Platform } from "./platforms";
import { SocialProviderError, type ConnectDescriptor, type ProviderAccount, type ProviderPost, type ProviderPostStatus, type PublishRequest, type PublishResult } from "./types";

/** Postory network → the Postiz provider used to connect it. */
const CONNECT_AS: Partial<Record<Platform, string>> = {
  x: "x",
  linkedin: "linkedin",
  facebook: "facebook",
  // Instagram's own login: needs a Business or Creator account, no Facebook Page.
  instagram: "instagram-standalone",
  threads: "threads",
  tiktok: "tiktok",
};

/** Networks Postory can connect and publish to through Postiz. */
export const POSTIZ_PLATFORMS = Object.keys(CONNECT_AS) as Platform[];

function platformFor(identifier: string): Platform | null {
  switch (identifier) {
    case "x":
      return "x";
    case "linkedin":
    case "linkedin-page":
      return "linkedin";
    case "facebook":
      return "facebook";
    case "instagram":
    case "instagram-standalone":
      return "instagram";
    case "threads":
      return "threads";
    case "tiktok":
      return "tiktok";
    case "bluesky":
      return "bluesky";
    case "pinterest":
      return "pinterest";
    default:
      return null;
  }
}

type Options = { method?: "GET" | "POST" | "DELETE"; json?: unknown; timeoutMs?: number };

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const key = env.postizApiKey();
  if (!key) throw new ConfigurationError("POSTIZ_API_KEY");
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Authorization: key, Accept: "application/json" };
  if (options.json !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${env.postizApiUrl()}${path}`, {
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    log.warn("postiz request failed", { operation: `${method} ${path.split("?")[0]}`, provider: "postiz" }, error);
    throw new SocialProviderError(timedOut ? "timeout" : "network_error", "Couldn't reach the publishing service. Try again.", {
      outcomeUnknown: method !== "GET",
      retryable: true,
    });
  }

  const body = (await res.json().catch(() => ({}))) as T & { msg?: string; message?: string | string[]; error?: string };
  if (res.ok) return body;

  const raw = body.msg ?? (Array.isArray(body.message) ? body.message.join("; ") : body.message) ?? body.error;
  const message = typeof raw === "string" && raw ? raw : `Publishing service returned HTTP ${res.status}.`;
  log.warn("postiz error response", { operation: `${method} ${path.split("?")[0]}`, provider: "postiz", status: res.status });
  throw new SocialProviderError(mapStatus(res.status), message, {
    status: res.status,
    retryable: res.status >= 500 || res.status === 429,
    outcomeUnknown: res.status >= 500 && method !== "GET",
  });
}

function mapStatus(status: number) {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 413) return "media_too_large";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation_failed";
  if (status >= 500) return "platform_unavailable";
  return "platform_rejected";
}

// --- Channels -----------------------------------------------------------------

type Integration = { id: string; name: string | null; identifier: string; picture: string | null; disabled: boolean; profile: string | null };

export async function listAccounts(): Promise<ProviderAccount[]> {
  const res = await request<Integration[]>("/integrations");
  return (Array.isArray(res) ? res : [])
    .map((i): ProviderAccount | null => {
      const platform = platformFor(i.identifier);
      if (!platform) return null;
      return {
        externalId: i.id,
        platform,
        displayName: i.profile || i.name,
        // One shared workspace: ownership is recorded in Postory, not here.
        externalProfileId: null,
        platformAccountId: i.id,
        tokenExpiresAt: null,
        needsReconnect: i.disabled,
        metadata: { name: i.name, username: i.profile, picture: i.picture, postizProvider: i.identifier },
      };
    })
    .filter((a): a is ProviderAccount => a !== null);
}

/** GET /social/{provider} — the network's own consent screen. Opens in a new tab; the user comes back and confirms. */
export async function startConnect(platform: Platform): Promise<ConnectDescriptor> {
  const provider = CONNECT_AS[platform];
  if (!provider) return { kind: "redirect", url: "", availability: "pending" };
  const res = await request<{ url?: string }>(`/social/${encodeURIComponent(provider)}`);
  if (!res.url) throw new SocialProviderError("unexpected_response", "The publishing service didn't return a connection link.");
  return { kind: "redirect", url: res.url, availability: "stable", newTab: true };
}

export async function disconnectAccount(integrationId: string): Promise<void> {
  try {
    await request(`/integrations/${encodeURIComponent(integrationId)}`, { method: "DELETE" });
  } catch (error) {
    // Already gone is the outcome we wanted.
    if (error instanceof SocialProviderError && error.status === 404) return;
    throw error;
  }
}

// --- Posts --------------------------------------------------------------------

/** Required per-network settings (from the Public API schemas). */
function settingsFor(platform: Platform, provider: string | undefined) {
  switch (platform) {
    case "x":
      return { __type: "x", who_can_reply_post: "everyone" };
    case "linkedin":
      return { __type: provider === "linkedin-page" ? "linkedin-page" : "linkedin" };
    case "instagram":
      return { __type: provider === "instagram" ? "instagram" : "instagram-standalone", post_type: "post" };
    case "tiktok":
      return {
        __type: "tiktok",
        privacy_level: "PUBLIC_TO_EVERYONE",
        duet: true,
        stitch: true,
        comment: true,
        autoAddMusic: "no",
        brand_content_toggle: false,
        brand_organic_toggle: false,
        // DIRECT_POST actually publishes; UPLOAD only drops it in the TikTok inbox.
        content_posting_method: "DIRECT_POST",
      };
    default:
      return { __type: provider ?? platform };
  }
}

async function importMedia(urls: string[]) {
  const media: { id: string; path: string }[] = [];
  for (const url of urls) {
    const file = await request<{ id?: string; path?: string }>("/upload-from-url", { method: "POST", json: { url }, timeoutMs: 60_000 });
    if (!file.id || !file.path) throw new SocialProviderError("unexpected_response", "The publishing service couldn't import the media.");
    media.push({ id: file.id, path: file.path });
  }
  return media;
}

export async function createPost(input: PublishRequest): Promise<PublishResult> {
  if (!CONNECT_AS[input.platform]) {
    return { status: "failed", externalPostId: null, batchId: null, uri: null, warnings: [], error: { code: "platform_not_enabled", message: "Publishing to this network isn't available yet." } };
  }
  const image = input.mediaUrls?.length ? await importMedia(input.mediaUrls) : [];
  const res = await request<{ postId?: string; integration?: string }[]>("/posts", {
    method: "POST",
    json: {
      type: input.scheduledAt ? "schedule" : "now",
      date: (input.scheduledAt ?? new Date()).toISOString(),
      shortLink: false,
      tags: [],
      posts: [{ integration: { id: input.accountExternalId }, value: [{ content: input.text, image }], settings: settingsFor(input.platform, input.providerHint) }],
    },
    timeoutMs: 60_000,
  });
  const postId = Array.isArray(res) ? res.find((r) => r.integration === input.accountExternalId)?.postId ?? res[0]?.postId : undefined;
  if (!postId) throw new SocialProviderError("unexpected_response", "The publishing service didn't return a post id.", { outcomeUnknown: true });

  if (input.scheduledAt) return { status: "queued", externalPostId: postId, batchId: null, uri: null, warnings: [], error: null };

  // Immediate: follow it briefly; the reconciler picks up anything slower.
  let latest: ProviderPost | null = null;
  for (const wait of [2000, 3000, 4000]) {
    await new Promise((r) => setTimeout(r, wait));
    latest = await getPost(postId).catch(() => null);
    if (latest && (latest.status === "published" || latest.status === "failed")) break;
  }
  return {
    status: latest?.status === "published" || latest?.status === "failed" ? latest.status : "publishing",
    externalPostId: postId,
    batchId: null,
    uri: latest?.uri ?? null,
    warnings: [],
    error: latest?.error ?? null,
  };
}

type PostizPost = { id: string; publishDate: string | null; releaseURL: string | null; state: "QUEUE" | "PUBLISHED" | "ERROR" | "DRAFT"; error: string | null };

const STATE: Record<PostizPost["state"], ProviderPostStatus> = { QUEUE: "queued", PUBLISHED: "published", ERROR: "failed", DRAFT: "queued" };

/** There's no single-post endpoint, so look it up in a window around now. */
export async function getPost(postId: string): Promise<ProviderPost> {
  const day = 24 * 60 * 60 * 1000;
  const start = new Date(Date.now() - 45 * day).toISOString();
  const end = new Date(Date.now() + 400 * day).toISOString();
  const res = await request<{ posts?: PostizPost[] }>(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
  const post = res.posts?.find((p) => p.id === postId);
  if (!post) throw new SocialProviderError("not_found", "The publishing service no longer has this post.", { status: 404 });
  const status = STATE[post.state] ?? "queued";
  return {
    externalPostId: post.id,
    status,
    scheduledAt: post.publishDate,
    publishedAt: status === "published" ? post.publishDate : null,
    uri: post.releaseURL || null,
    error: status === "failed" ? { code: "platform_rejected", message: post.error || "The network rejected this post." } : null,
  };
}

export async function cancelPost(postId: string): Promise<void> {
  try {
    await request(`/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof SocialProviderError && error.status === 404) return;
    throw error;
  }
}

// --- Analytics ----------------------------------------------------------------

export type PostizMetrics = { impressions: number | null; reach: number | null; reactions: number | null; comments: number | null; reposts: number | null };

/**
 * GET /analytics/post/{postId}?date=N — series per metric, labelled by the
 * network ("Likes", "Comments", ...). We keep the latest total of the ones we
 * show; anything a network doesn't report stays null (never estimated).
 */
export async function postMetrics(postId: string, days = 30): Promise<PostizMetrics | null> {
  const res = await request<{ label?: string; data?: { total?: string | number }[] }[]>(`/analytics/post/${encodeURIComponent(postId)}?date=${days}`);
  if (!Array.isArray(res) || !res.length) return null;
  const latest = (pattern: RegExp) => {
    const series = res.find((m) => m.label && pattern.test(m.label));
    const last = series?.data?.at(-1)?.total;
    const n = typeof last === "number" ? last : typeof last === "string" ? Number(last) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const metrics = {
    impressions: latest(/impression|view/i),
    reach: latest(/reach/i),
    reactions: latest(/like|reaction|favou?rite/i),
    comments: latest(/comment|repl/i),
    reposts: latest(/share|repost|retweet/i),
  };
  return Object.values(metrics).some((v) => v !== null) ? metrics : null;
}
