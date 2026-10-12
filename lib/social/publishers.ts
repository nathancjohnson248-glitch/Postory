import "server-only";

/**
 * Posting straight to each network's own API, authenticated through Nango's
 * proxy. Every call here was checked against the network's official docs:
 *   X           POST /2/tweets, POST /2/media/upload           (docs.x.com)
 *   LinkedIn    GET /v2/userinfo, POST /rest/images?action=initializeUpload,
 *               PUT <uploadUrl>, POST /rest/posts               (learn.microsoft.com/linkedin)
 *   Threads     POST /v1.0/{id}/threads, /threads_publish       (developers.facebook.com/docs/threads)
 *   Instagram   POST /v25.0/{id}/media, /media_publish          (Instagram API with Instagram Login)
 *   Pinterest   GET /v5/boards, POST /v5/pins                   (developers.pinterest.com/docs/api/v5)
 *   Facebook    GET /v25.0/me/accounts, POST /{page}/feed|photos with the Page token
 */

import type { Platform } from "./platforms";
import { accessToken, proxy, proxyWithHeaders, type ProxyTarget } from "./nango";
import { SocialProviderError } from "./types";

export type Profile = { id: string; username: string | null; name: string | null; avatar: string | null };
export type Published = { postId: string; url: string | null };

const LINKEDIN_HEADERS = { "LinkedIn-Version": "202609", "X-Restli-Protocol-Version": "2.0.0" };

// --- Profiles ---------------------------------------------------------------------

export async function profile(platform: Platform, t: ProxyTarget): Promise<Profile> {
  switch (platform) {
    case "x": {
      const r = await proxy<{ data?: { id: string; username?: string; name?: string; profile_image_url?: string } }>(t, "/2/users/me?user.fields=profile_image_url");
      const d = r.data;
      if (!d?.id) throw unexpected();
      return { id: d.id, username: d.username ?? null, name: d.name ?? null, avatar: d.profile_image_url ?? null };
    }
    case "linkedin": {
      // LinkedIn has no public handle; the member id is `sub`.
      const r = await proxy<{ sub?: string; name?: string; picture?: string }>(t, "/v2/userinfo");
      if (!r.sub) throw unexpected();
      return { id: r.sub, username: null, name: r.name ?? null, avatar: r.picture ?? null };
    }
    case "threads": {
      const r = await proxy<{ id?: string; username?: string; name?: string; threads_profile_picture_url?: string }>(t, "/v1.0/me?fields=id,username,name,threads_profile_picture_url");
      if (!r.id) throw unexpected();
      return { id: r.id, username: r.username ?? null, name: r.name ?? null, avatar: r.threads_profile_picture_url ?? null };
    }
    case "instagram": {
      type Me = { user_id?: string; id?: string; username?: string; name?: string; profile_picture_url?: string };
      const r = await proxy<Me & { data?: Me[] }>(t, "/v25.0/me?fields=user_id,username,name,profile_picture_url");
      const d = r.data?.[0] ?? r;
      const id = d.user_id ?? d.id;
      if (!id) throw unexpected();
      return { id, username: d.username ?? null, name: d.name ?? null, avatar: d.profile_picture_url ?? null };
    }
    case "pinterest": {
      const r = await proxy<{ id?: string; username?: string; business_name?: string; profile_image?: string }>(t, "/v5/user_account");
      if (!r.username && !r.id) throw unexpected();
      return { id: r.id ?? r.username!, username: r.username ?? null, name: r.business_name ?? r.username ?? null, avatar: r.profile_image ?? null };
    }
    case "facebook": {
      const page = await facebookPage(t);
      return { id: page.id, username: null, name: page.name, avatar: page.picture };
    }
    default:
      throw new SocialProviderError("platform_not_enabled", "This network isn't available yet.");
  }
}

// --- Publishing ---------------------------------------------------------------------

/** Publish now. `imageUrl` is a short-lived public HTTPS link to the post's image, if it has one. */
export async function publish(platform: Platform, t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  switch (platform) {
    case "x":
      return publishX(t, text, imageUrl);
    case "linkedin":
      return publishLinkedIn(t, text, imageUrl);
    case "threads":
      return publishThreads(t, text, imageUrl);
    case "instagram":
      return publishInstagram(t, text, imageUrl);
    case "pinterest":
      return publishPinterest(t, text, imageUrl);
    case "facebook":
      return publishFacebook(t, text, imageUrl);
    default:
      throw new SocialProviderError("platform_not_enabled", "Publishing to this network isn't available yet.");
  }
}

async function publishX(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  let mediaIds: string[] | undefined;
  if (imageUrl) {
    // X takes the bytes, not a URL.
    const bytes = await download(imageUrl, 5 * 1024 * 1024);
    const up = await proxy<{ data?: { id?: string } }>(t, "/2/media/upload", { method: "POST", json: { media: bytes.toString("base64"), media_category: "tweet_image" } });
    if (!up.data?.id) throw unexpected();
    mediaIds = [up.data.id];
  }
  const [me, post] = await Promise.all([
    proxy<{ data?: { username?: string } }>(t, "/2/users/me").catch(() => null),
    proxy<{ data?: { id?: string } }>(t, "/2/tweets", { method: "POST", json: { text, ...(mediaIds ? { media: { media_ids: mediaIds } } : {}) } }),
  ]);
  const id = post.data?.id;
  if (!id) throw unexpected();
  const username = me?.data?.username;
  return { postId: id, url: username ? `https://x.com/${username}/status/${id}` : `https://x.com/i/web/status/${id}` };
}

/** LinkedIn's "little text": these characters must be escaped in commentary. */
function littleText(text: string) {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

async function publishLinkedIn(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  const me = await proxy<{ sub?: string }>(t, "/v2/userinfo");
  if (!me.sub) throw unexpected();
  const author = `urn:li:person:${me.sub}`;

  let media: { id: string } | undefined;
  if (imageUrl) {
    const init = await proxy<{ value?: { uploadUrl?: string; image?: string } }>(t, "/rest/images?action=initializeUpload", {
      method: "POST",
      headers: LINKEDIN_HEADERS,
      json: { initializeUploadRequest: { owner: author } },
    });
    if (!init.value?.uploadUrl || !init.value.image) throw unexpected();
    // The upload host isn't api.linkedin.com, so this PUT goes direct with the member's token.
    const [bytes, token] = await Promise.all([download(imageUrl, 8 * 1024 * 1024), accessToken(t)]);
    const put = await fetch(init.value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(60_000) });
    if (!put.ok) throw new SocialProviderError("platform_rejected", "LinkedIn didn't accept the image.", { status: put.status });
    media = { id: init.value.image };
  }

  const { headers } = await proxyWithHeaders<unknown>(t, "/rest/posts", {
    method: "POST",
    headers: LINKEDIN_HEADERS,
    json: {
      author,
      commentary: littleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(media ? { content: { media } } : {}),
    },
  });
  const urn = headers.get("x-restli-id");
  if (!urn) throw unexpected();
  return { postId: urn, url: `https://www.linkedin.com/feed/update/${urn}/` };
}

async function waitUntilFinished(t: ProxyTarget, path: string, field: "status" | "status_code") {
  for (const wait of [3000, 4000, 5000, 6000, 8000, 10000]) {
    await new Promise((r) => setTimeout(r, wait));
    const s = await proxy<Record<string, string | undefined>>(t, `${path}?fields=${field}`).catch(() => null);
    const state = s?.[field];
    if (state === "FINISHED") return;
    if (state === "ERROR" || state === "EXPIRED") throw new SocialProviderError("platform_rejected", "The network couldn't process the image.");
  }
  throw new SocialProviderError("timeout", "The network took too long to process the image. Try again.", { retryable: true });
}

async function publishThreads(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  const me = await proxy<{ id?: string }>(t, "/v1.0/me?fields=id");
  if (!me.id) throw unexpected();
  const q = new URLSearchParams({ text, ...(imageUrl ? { media_type: "IMAGE", image_url: imageUrl } : { media_type: "TEXT" }) });
  const container = await proxy<{ id?: string }>(t, `/v1.0/${me.id}/threads?${q}`, { method: "POST" });
  if (!container.id) throw unexpected();
  if (imageUrl) await waitUntilFinished(t, `/v1.0/${container.id}`, "status");
  const published = await proxy<{ id?: string }>(t, `/v1.0/${me.id}/threads_publish?creation_id=${encodeURIComponent(container.id)}`, { method: "POST" });
  if (!published.id) throw unexpected();
  const link = await proxy<{ permalink?: string }>(t, `/v1.0/${published.id}?fields=permalink`).catch(() => null);
  return { postId: published.id, url: link?.permalink ?? null };
}

async function publishInstagram(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  if (!imageUrl) throw new SocialProviderError("media_required", "Instagram posts need an image.");
  const p = await profile("instagram", t);
  const container = await proxy<{ id?: string }>(t, `/v25.0/${p.id}/media`, { method: "POST", json: { image_url: imageUrl, caption: text } });
  if (!container.id) throw unexpected();
  await waitUntilFinished(t, `/v25.0/${container.id}`, "status_code");
  const published = await proxy<{ id?: string }>(t, `/v25.0/${p.id}/media_publish`, { method: "POST", json: { creation_id: container.id } });
  if (!published.id) throw unexpected();
  const link = await proxy<{ permalink?: string }>(t, `/v25.0/${published.id}?fields=permalink`).catch(() => null);
  return { postId: published.id, url: link?.permalink ?? null };
}

async function publishPinterest(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  if (!imageUrl) throw new SocialProviderError("media_required", "Pins need an image.");
  const boards = await proxy<{ items?: { id: string; name: string }[] }>(t, "/v5/boards?page_size=25");
  const board = boards.items?.[0];
  if (!board) throw new SocialProviderError("platform_rejected", "Create a board on Pinterest first — every Pin is saved to a board.");
  const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "";
  const pin = await proxy<{ id?: string }>(t, "/v5/pins", {
    method: "POST",
    json: { board_id: board.id, title: firstLine.slice(0, 100), description: text.slice(0, 800), media_source: { source_type: "image_url", url: imageUrl } },
  });
  if (!pin.id) throw unexpected();
  return { postId: pin.id, url: `https://www.pinterest.com/pin/${pin.id}/` };
}

/** The first Page the person can post to, with a fresh Page token. */
async function facebookPage(t: ProxyTarget) {
  const r = await proxy<{ data?: { id: string; name: string; access_token?: string; tasks?: string[]; picture?: { data?: { url?: string } } }[] }>(
    t,
    "/v25.0/me/accounts?fields=id,name,access_token,picture,tasks",
  );
  const page = (r.data ?? []).find((p) => p.access_token && (!p.tasks || p.tasks.includes("CREATE_CONTENT")));
  if (!page?.access_token) throw new SocialProviderError("platform_rejected", "Postory couldn't find a Facebook Page you can post to.");
  return { id: page.id, name: page.name, token: page.access_token, picture: page.picture?.data?.url ?? null };
}

async function publishFacebook(t: ProxyTarget, text: string, imageUrl: string | null): Promise<Published> {
  const page = await facebookPage(t);
  // A query access_token takes precedence over the user token Nango injects.
  const auth = `access_token=${encodeURIComponent(page.token)}`;
  if (imageUrl) {
    const r = await proxy<{ id?: string; post_id?: string }>(t, `/v25.0/${page.id}/photos?${auth}`, { method: "POST", json: { url: imageUrl, caption: text } });
    const id = r.post_id ?? r.id;
    if (!id) throw unexpected();
    return { postId: id, url: await facebookPermalink(t, id, auth) };
  }
  const r = await proxy<{ id?: string }>(t, `/v25.0/${page.id}/feed?${auth}`, { method: "POST", json: { message: text } });
  if (!r.id) throw unexpected();
  return { postId: r.id, url: await facebookPermalink(t, r.id, auth) };
}

async function facebookPermalink(t: ProxyTarget, id: string, auth: string) {
  const r = await proxy<{ permalink_url?: string }>(t, `/v25.0/${id}?fields=permalink_url&${auth}`).catch(() => null);
  return r?.permalink_url ?? null;
}

// --- Helpers ------------------------------------------------------------------------

async function download(url: string, maxBytes: number) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new SocialProviderError("media_unavailable", "Postory couldn't read the image to upload it.");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > maxBytes) throw new SocialProviderError("media_too_large", "The image is too large for this network.");
  return bytes;
}

function unexpected() {
  return new SocialProviderError("unexpected_response", "The network answered in a way Postory didn't expect. Try again.", { outcomeUnknown: true });
}
