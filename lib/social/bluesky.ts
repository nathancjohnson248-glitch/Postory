import "server-only";

/**
 * Bluesky over the AT Protocol (https://docs.bsky.app). Nango doesn't support
 * Bluesky, so accounts connect with an app password (Settings → Privacy and
 * security → App passwords on Bluesky), which can post but can't change the
 * account or read DMs, and can be revoked there at any time.
 *
 *   POST com.atproto.server.createSession   sign in with the app password
 *   GET  app.bsky.actor.getProfile          name and avatar
 *   POST com.atproto.repo.uploadBlob        an image (≤ 1 MB)
 *   POST com.atproto.repo.createRecord      a post (app.bsky.feed.post)
 *   GET  app.bsky.feed.getPosts             like/repost/reply/quote counts
 *   GET  app.bsky.feed.getPostThread        replies to a post
 */

import { log } from "@/lib/log";
import { SocialProviderError, type PostMetrics, type Published, type RemoteComment } from "./types";

const PDS = "https://bsky.social/xrpc";
const MAX_IMAGE_BYTES = 1_000_000;

export type BlueskyLogin = { identifier: string; appPassword: string };
type Session = { did: string; handle: string; accessJwt: string; at: number };

/** Sessions are reused for an hour so routine work doesn't hit Bluesky's sign-in rate limit. */
const sessions = new Map<string, Session>();

async function xrpc<T>(method: string, init: { session?: Session; query?: Record<string, string | string[]>; json?: unknown; body?: Uint8Array; contentType?: string } = {}): Promise<T> {
  const url = new URL(`${PDS}/${method}`);
  for (const [k, v] of Object.entries(init.query ?? {})) for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.session) headers.Authorization = `Bearer ${init.session.accessJwt}`;
  if (init.json !== undefined) headers["Content-Type"] = "application/json";
  if (init.body) headers["Content-Type"] = init.contentType ?? "application/octet-stream";
  const isWrite = init.json !== undefined || init.body !== undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      method: isWrite ? "POST" : "GET",
      headers,
      body: init.body ? new Uint8Array(init.body) : init.json !== undefined ? JSON.stringify(init.json) : undefined,
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (error) {
    log.warn("bluesky request failed", { operation: method, provider: "bluesky" }, error);
    throw new SocialProviderError("network_error", "Couldn't reach Bluesky. Try again.", { outcomeUnknown: isWrite, retryable: true });
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (res.ok) return data;
  log.warn("bluesky error response", { operation: method, provider: "bluesky", status: res.status, code: data.error });
  if (res.status === 401 || data.error === "AuthenticationRequired" || data.error === "ExpiredToken") {
    throw new SocialProviderError("platform_auth_failed", "Bluesky didn't accept the sign-in. Check the handle and app password, or make a new app password.", { status: 401 });
  }
  if (res.status === 429) throw new SocialProviderError("rate_limited", "Bluesky is rate-limiting requests. Try again in a few minutes.", { status: 429, retryable: true });
  if (res.status >= 500) throw new SocialProviderError("platform_unavailable", "Bluesky is having trouble right now. Try again shortly.", { status: res.status, retryable: true, outcomeUnknown: isWrite });
  throw new SocialProviderError("platform_rejected", data.message ?? "Bluesky rejected the request.", { status: res.status });
}

/** Sign in. `cacheKey` (the account id) lets later calls reuse the session. */
export async function signIn(login: BlueskyLogin, cacheKey?: string): Promise<Session> {
  const cached = cacheKey ? sessions.get(cacheKey) : undefined;
  if (cached && Date.now() - cached.at < 60 * 60_000) return cached;
  const s = await xrpc<{ did?: string; handle?: string; accessJwt?: string }>("com.atproto.server.createSession", {
    json: { identifier: login.identifier.replace(/^@/, "").trim(), password: login.appPassword.trim() },
  });
  if (!s.did || !s.accessJwt || !s.handle) throw new SocialProviderError("unexpected_response", "Bluesky answered in a way Postory didn't expect.");
  const session = { did: s.did, handle: s.handle, accessJwt: s.accessJwt, at: Date.now() };
  if (cacheKey) sessions.set(cacheKey, session);
  return session;
}

export function forgetSession(cacheKey: string) {
  sessions.delete(cacheKey);
}

export async function profile(session: Session) {
  const p = await xrpc<{ displayName?: string; avatar?: string }>("app.bsky.actor.getProfile", { session, query: { actor: session.did } }).catch(() => null);
  return { id: session.did, username: session.handle, name: p?.displayName || null, avatar: p?.avatar ?? null };
}

/** Link facets so URLs in the text are clickable (Bluesky indexes by UTF-8 byte). */
function linkFacets(text: string) {
  const facets: unknown[] = [];
  const encoder = new TextEncoder();
  for (const match of text.matchAll(/https?:\/\/[^\s)]+[^\s).,!?:;'"]/g)) {
    const start = encoder.encode(text.slice(0, match.index)).length;
    facets.push({
      index: { byteStart: start, byteEnd: start + encoder.encode(match[0]).length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: match[0] }],
    });
  }
  return facets;
}

function postUrl(handle: string, uri: string) {
  return `https://bsky.app/profile/${handle}/post/${uri.split("/").pop()}`;
}

export async function publish(session: Session, text: string, image: { bytes: Buffer; contentType: string; alt: string } | null, reply?: { root: { uri: string; cid: string }; parent: { uri: string; cid: string } }): Promise<Published> {
  let embed: unknown;
  if (image) {
    if (image.bytes.length > MAX_IMAGE_BYTES) throw new SocialProviderError("media_too_large", "Bluesky takes images up to 1 MB. Use a smaller image.");
    const up = await xrpc<{ blob?: unknown }>("com.atproto.repo.uploadBlob", { session, body: image.bytes, contentType: image.contentType });
    if (!up.blob) throw new SocialProviderError("unexpected_response", "Bluesky didn't accept the image.");
    embed = { $type: "app.bsky.embed.images", images: [{ alt: image.alt.slice(0, 1000), image: up.blob }] };
  }
  const facets = linkFacets(text);
  const created = await xrpc<{ uri?: string; cid?: string }>("com.atproto.repo.createRecord", {
    session,
    json: {
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text,
        createdAt: new Date().toISOString(),
        ...(facets.length ? { facets } : {}),
        ...(embed ? { embed } : {}),
        ...(reply ? { reply } : {}),
      },
    },
  });
  if (!created.uri) throw new SocialProviderError("unexpected_response", "Bluesky answered in a way Postory didn't expect.", { outcomeUnknown: true });
  return { postId: created.uri, url: postUrl(session.handle, created.uri) };
}

export async function metrics(session: Session, uris: string[]): Promise<Record<string, PostMetrics>> {
  const out: Record<string, PostMetrics> = {};
  for (let i = 0; i < uris.length; i += 25) {
    const r = await xrpc<{ posts?: { uri: string; likeCount?: number; repostCount?: number; replyCount?: number; quoteCount?: number }[] }>("app.bsky.feed.getPosts", {
      session,
      query: { uris: uris.slice(i, i + 25) },
    });
    for (const p of r.posts ?? []) {
      out[p.uri] = { impressions: null, reach: null, reactions: p.likeCount ?? 0, comments: p.replyCount ?? 0, reposts: (p.repostCount ?? 0) + (p.quoteCount ?? 0) };
    }
  }
  return out;
}

type ThreadPost = { uri: string; cid: string; author?: { did?: string; handle?: string; displayName?: string }; record?: { text?: string; createdAt?: string; reply?: { root?: { uri: string; cid: string } } } };

export async function replies(session: Session, uri: string): Promise<RemoteComment[]> {
  const r = await xrpc<{ thread?: { post?: ThreadPost; replies?: { post?: ThreadPost }[] } }>("app.bsky.feed.getPostThread", { session, query: { uri, depth: "1" } });
  const root = r.thread?.post;
  if (!root) return [];
  return (r.thread?.replies ?? [])
    .map((x) => x.post)
    .filter((p): p is ThreadPost => Boolean(p?.uri && p.cid && p.author?.did !== session.did))
    .map((p) => ({
      id: p.uri,
      authorName: p.author?.displayName || null,
      authorHandle: p.author?.handle ? `@${p.author.handle}` : null,
      text: p.record?.text ?? "",
      createdAt: p.record?.createdAt ?? new Date().toISOString(),
      url: p.author?.handle ? postUrl(p.author.handle, p.uri) : null,
      context: { root: p.record?.reply?.root ?? { uri: root.uri, cid: root.cid }, parent: { uri: p.uri, cid: p.cid } },
    }));
}
