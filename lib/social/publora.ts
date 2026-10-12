import "server-only";

/**
 * Publora adapter — https://docs.publora.com (REST base api.publora.com/api/v1).
 *
 * Every call maps to an endpoint in Publora's published docs. Each Postory
 * user is a Publora *managed user* (Workspace API) with their own isolated
 * social connections; requests made on their behalf carry
 * `x-publora-user-id`. Application code reaches this only through
 * lib/social/service.ts.
 *
 * Auth: `x-publora-key: <PUBLORA_API_KEY>`. Writes send `Idempotency-Key`
 * so a retried request replays the original response instead of posting twice.
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

const BASE = "https://api.publora.com/api/v1";

export function platformFromConnectionId(connectionId: string): Platform | null {
  const prefix = connectionId.split("-")[0];
  if (prefix === "twitter") return "x";
  return isPlatform(prefix) && prefix !== "x" ? prefix : null;
}

/** Pinterest can be connected at Publora but not published to. */
export function canPublishTo(platform: Platform) {
  return platform !== "pinterest";
}

type Options = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  json?: unknown;
  userId?: string | null;
  idempotencyKey?: string;
  timeoutMs?: number;
};

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const key = env.publoraApiKey();
  if (!key) throw new ConfigurationError("PUBLORA_API_KEY");
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { "x-publora-key": key, Accept: "application/json" };
  if (options.json !== undefined) headers["Content-Type"] = "application/json";
  if (options.userId) headers["x-publora-user-id"] = options.userId;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    log.warn("publora request failed", { operation: `${method} ${path.split("?")[0]}`, provider: "publora" }, error);
    // A write may have reached Publora before the connection dropped.
    throw new SocialProviderError(timedOut ? "timeout" : "network_error", "Couldn't reach the publishing service. Try again.", {
      outcomeUnknown: method !== "GET",
      retryable: true,
    });
  }

  const body = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; message?: string };
  if (res.ok) return body;

  const message = body.error || body.message || `Publishing service returned HTTP ${res.status}.`;
  log.warn("publora error response", { operation: `${method} ${path.split("?")[0]}`, provider: "publora", status: res.status, code: body.code });
  throw new SocialProviderError(mapErrorCode(res.status, body.code, message), message, {
    status: res.status,
    retryable: res.status >= 500 || res.status === 429,
    outcomeUnknown: res.status >= 500 && method !== "GET",
  });
}

function mapErrorCode(status: number, code: string | undefined, message: string): string {
  if (/workspace access is not enabled/i.test(message)) return "workspace_not_enabled";
  switch (code) {
    case "PLATFORM_AUTH_EXPIRED":
      return "platform_auth_failed";
    case "RATE_LIMITED":
      return "rate_limited";
    case "INVALID_CONTENT":
    case "CONTENT_TOO_LARGE":
      return "platform_rejected";
    case "PLATFORM_SERVER_ERROR":
      return "platform_unavailable";
    case "NETWORK_ERROR":
      return "network_error";
    case "TIMEOUT_ERROR":
      return "timeout";
  }
  if (status === 401) return "unauthenticated";
  if (status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "idempotency_conflict";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation_failed";
  if (status >= 500) return "platform_unavailable";
  return "platform_rejected";
}

// --- Managed users (one per Postory user) -----------------------------------

/** POST /workspace/users — returns the new managed user's id. */
export async function createManagedUser(input: { username: string; displayName: string }) {
  const res = await request<{ user?: { _id?: string } }>("/workspace/users", { method: "POST", json: input });
  const id = res.user?._id;
  if (!id) throw new SocialProviderError("unexpected_response", "The publishing service didn't return a workspace id.");
  return id;
}

/** POST /workspace/users/:id/connection-url — a link where the user connects their own accounts. */
export async function connectionUrl(managedUserId: string) {
  const res = await request<{ url?: string; tokenExpiresAt?: string }>(`/workspace/users/${encodeURIComponent(managedUserId)}/connection-url`, {
    method: "POST",
    json: { expiresInDays: 1, rotate: true },
  });
  if (!res.url) throw new SocialProviderError("unexpected_response", "The publishing service didn't return a connection link.");
  return res.url;
}

// --- Accounts -----------------------------------------------------------------

type Connection = {
  platformId: string;
  username: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
  profileUrl: string | null;
  accessTokenExpiresAt: string | null;
  tokenStatus?: string;
  connectionStatus?: string;
  lastError?: { message?: string; occurredAt?: string } | null;
};

/** GET /platform-connections for one managed user. */
export async function listAccounts(managedUserId?: string | null): Promise<ProviderAccount[]> {
  const res = await request<{ connections?: Connection[] }>("/platform-connections", { userId: managedUserId });
  return (res.connections ?? [])
    .map((c): ProviderAccount | null => {
      const platform = platformFromConnectionId(c.platformId);
      if (!platform) return null;
      return {
        externalId: c.platformId,
        platform,
        displayName: c.displayName || c.username,
        externalProfileId: managedUserId ?? null,
        platformAccountId: c.platformId.slice(c.platformId.indexOf("-") + 1),
        tokenExpiresAt: c.accessTokenExpiresAt,
        needsReconnect: c.connectionStatus === "reconnect_required" || c.tokenStatus === "expired",
        metadata: {
          username: c.username,
          profileImageUrl: c.profileImageUrl,
          profileUrl: c.profileUrl,
          tokenStatus: c.tokenStatus ?? null,
          lastError: c.lastError?.message ?? null,
        },
      };
    })
    .filter((a): a is ProviderAccount => a !== null);
}

/**
 * Publora connects every network from one page, so the link isn't
 * per-network: the person picks the network there. It opens in a new tab and
 * Postory reads back what was connected.
 */
export async function startConnect(_platform: Platform, input: { profileId?: string | null }): Promise<ConnectDescriptor> {
  if (!input.profileId) throw new SocialProviderError("workspace_not_enabled", "No publishing workspace yet.");
  return { kind: "redirect", url: await connectionUrl(input.profileId), availability: "stable", newTab: true };
}

/** Publora disconnects accounts from its own connections page only. */
export async function disconnectAccount(): Promise<void> {
  throw new SocialProviderError("not_supported", "Disconnect from the connections page.");
}

// --- Posts ----------------------------------------------------------------------

type GroupResponse = {
  postGroupId: string;
  status?: string;
  scheduledTime?: string | null;
  posts?: { status?: string; permalink?: string | null; error?: { code?: string; message?: string } | null }[];
};

function mapStatus(group: GroupResponse): ProviderPostStatus {
  const post = group.posts?.[0];
  const status = post?.status ?? group.status ?? "";
  switch (status) {
    case "published":
      return "published";
    case "failed":
    case "partially_published":
      return post?.status === "published" ? "published" : "failed";
    case "pending":
    case "processing":
      return "publishing";
    case "scheduled":
    case "draft":
      return "queued";
    default:
      return "queued";
  }
}

function toProviderPost(group: GroupResponse): ProviderPost {
  const post = group.posts?.[0];
  const status = mapStatus(group);
  return {
    externalPostId: group.postGroupId,
    status,
    scheduledAt: group.scheduledTime ?? null,
    publishedAt: status === "published" ? new Date().toISOString() : null,
    uri: post?.permalink ?? null,
    error: status === "failed" ? { code: mapErrorCode(422, post?.error?.code, post?.error?.message ?? ""), message: post?.error?.message ?? "The network rejected the post." } : null,
  };
}

/** GET /get-post/:postGroupId */
export async function getPost(postGroupId: string, managedUserId?: string | null): Promise<ProviderPost> {
  const res = await request<GroupResponse>(`/get-post/${encodeURIComponent(postGroupId)}`, { userId: managedUserId });
  return toProviderPost({ ...res, postGroupId: res.postGroupId ?? postGroupId });
}

/**
 * POST /create-post for one connection. Publora queues every post (even
 * "now"), so an immediate post is followed briefly to report its outcome;
 * if it's still in flight, the caller records it as publishing and the
 * reconciler finishes the job.
 */
export async function createPost(input: PublishRequest): Promise<PublishResult> {
  if (!canPublishTo(input.platform)) {
    return { status: "failed", externalPostId: null, batchId: null, uri: null, warnings: [], error: { code: "platform_not_enabled", message: "Pinterest can be connected but not published to yet." } };
  }
  const res = await request<{ postGroupId?: string; scheduledTime?: string | null; warnings?: { message?: string }[] }>("/create-post", {
    method: "POST",
    userId: input.externalProfileId,
    idempotencyKey: input.idempotencyKey,
    json: {
      content: input.text,
      platforms: [input.accountExternalId],
      // A time is required for Publora to queue it (omitting it makes a draft).
      scheduledTime: (input.scheduledAt ?? new Date()).toISOString(),
      ...(input.mediaUrls?.length ? { mediaUrls: input.mediaUrls } : {}),
    },
    timeoutMs: 60_000,
  });
  if (!res.postGroupId) throw new SocialProviderError("unexpected_response", "The publishing service didn't return a post id.", { outcomeUnknown: true });
  const warnings = (res.warnings ?? []).map((w) => w.message ?? "").filter(Boolean);

  if (input.scheduledAt) {
    return { status: "queued", externalPostId: res.postGroupId, batchId: null, uri: null, warnings, error: null };
  }

  // Immediate: follow it for a few seconds.
  let latest: ProviderPost | null = null;
  for (const wait of [1500, 2500, 3500, 4500]) {
    await new Promise((r) => setTimeout(r, wait));
    try {
      latest = await getPost(res.postGroupId, input.externalProfileId);
    } catch {
      continue;
    }
    if (latest.status === "published" || latest.status === "failed") break;
  }
  return {
    status: latest?.status === "published" || latest?.status === "failed" ? latest.status : "publishing",
    externalPostId: res.postGroupId,
    batchId: null,
    uri: latest?.uri ?? null,
    warnings,
    error: latest?.error ?? null,
  };
}

/** PUT /update-post/:postGroupId — move a scheduled post. */
export async function reschedulePost(postGroupId: string, scheduledAt: Date, managedUserId?: string | null): Promise<void> {
  await request(`/update-post/${encodeURIComponent(postGroupId)}`, {
    method: "PUT",
    userId: managedUserId,
    idempotencyKey: `reschedule-${postGroupId}-${scheduledAt.getTime()}`,
    json: { scheduledTime: scheduledAt.toISOString() },
  });
}

/** DELETE /delete-post/:postGroupId — cancel a scheduled post. */
export async function cancelPost(postGroupId: string, managedUserId?: string | null): Promise<void> {
  await request(`/delete-post/${encodeURIComponent(postGroupId)}`, { method: "DELETE", userId: managedUserId });
}
