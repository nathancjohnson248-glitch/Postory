import "server-only";

/**
 * Postory's social service: the only place application code goes to connect
 * accounts, publish, schedule, or read engagement back.
 *
 *   Nango     X, LinkedIn, Threads, Instagram, Facebook, Pinterest. Nango holds
 *             the OAuth tokens; ./publishers.ts calls each network's API
 *             through Nango's proxy.
 *   Bluesky   app password (Nango has no Bluesky), stored encrypted
 *             (./credentials.ts), used by ./bluesky.ts.
 *   TikTok    not connectable: TikTok only lets audited apps publish.
 *
 * Invariants
 *   - A social_accounts row exists only for an account the network confirmed.
 *     Nothing is marked connected because a button was clicked.
 *   - A post is marked published only after the network returns its id.
 *   - Every publish claims the post with a compare-and-set status update, so
 *     two clicks (or the scheduler and a click) can never send it twice.
 *   - Scheduling is Postory's own (./scheduler.ts); it re-checks the plan and
 *     the account at send time.
 */

import { describeSocialError, UserFacingError } from "@/lib/errors";
import { notifyUser } from "@/lib/email/notify";
import { integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeUsage, getEntitlements, assertActivePlan, canConnectAnotherAccount } from "@/lib/entitlements";
import { PLANS, X_CREDITS_PER_POST } from "@/lib/billing/plans";
import { MEDIA_BUCKET, parseMedia, type PostMedia } from "@/lib/posts/media";
import { assertTransition, isPostStatus, type PostStatus } from "@/lib/posts/state-machine";
import * as bluesky from "./bluesky";
import { credentialsAvailable, deleteCredential, readCredential, saveCredential } from "./credentials";
import * as nango from "./nango";
import { PLATFORMS, PLATFORM_META, validatePostContent, type Platform } from "./platforms";
import * as publishers from "./publishers";
import { SocialProviderError, type ConnectionKind, type PostMetrics, type ProviderAccount, type Published, type RemoteComment } from "./types";
import type { Json, Tables } from "@/types/database";

type StoryPost = Tables<"story_posts">;
type SocialAccount = Tables<"social_accounts">;

const CONNECT_ATTEMPT_TTL_MS = 30 * 60 * 1000;
/** A post stuck in "publishing" this long was interrupted (deploy, crash); we stop waiting on it. */
const STUCK_PUBLISHING_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Readiness and availability
// ---------------------------------------------------------------------------

export type SocialReadiness = { ready: true } | { ready: false; reason: "provider_not_configured"; message: string };

export async function getSocialReadiness(): Promise<SocialReadiness> {
  if (integrations.nango() || credentialsAvailable()) return { ready: true };
  return { ready: false, reason: "provider_not_configured", message: "Connecting networks isn't configured on this Postory deployment yet." };
}

export type NetworkAvailability = { available: true; method: "session" | "credentials" } | { available: false; reason: string };

/** Whether each network can be connected right now, and how. */
export async function networkAvailability(): Promise<Record<Platform, NetworkAvailability>> {
  const nangoReady = integrations.nango() ? new Set(await nango.availablePlatforms()) : new Set<Platform>();
  const out = {} as Record<Platform, NetworkAvailability>;
  for (const platform of PLATFORMS) {
    const meta = PLATFORM_META[platform];
    if (meta.connect === "none") out[platform] = { available: false, reason: meta.limitation ?? "Not available yet." };
    else if (meta.connect === "app_password") out[platform] = credentialsAvailable() ? { available: true, method: "credentials" } : { available: false, reason: "Bluesky isn't set up on this deployment yet." };
    else out[platform] = nangoReady.has(platform) ? { available: true, method: "session" } : { available: false, reason: `${meta.name} is being set up. Your other networks work as normal.` };
  }
  return out;
}

function toUserError(error: unknown, platform: string | undefined, operation: "connect" | "publish" | "schedule" | "sync") {
  if (error instanceof UserFacingError) return error;
  if (error instanceof SocialProviderError) {
    const described = describeSocialError(error.code, {
      platform: platform ?? error.options.platform,
      message: error.message,
      remediation: error.options.remediation,
      operation,
      outcomeUnknown: error.options.outcomeUnknown,
    });
    return new UserFacingError(described.code, described.message, described.action);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listConnectedAccounts(userId: string) {
  const { data } = await createAdminClient()
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "disconnected")
    .order("connected_at", { ascending: true });
  return data ?? [];
}

async function assertCanConnect(userId: string) {
  const [entitlements, existing] = await Promise.all([getEntitlements(userId), listConnectedAccounts(userId)]);
  // Before a plan is chosen (during onboarding) allow up to the Solo allowance.
  const allowed = entitlements.active ? canConnectAnotherAccount(entitlements, existing.length) : existing.length < (PLANS.solo.limits.socialAccounts ?? 0);
  if (!allowed) {
    const next = entitlements.plan === "solo" ? PLANS.pro : entitlements.plan === "pro" ? PLANS.max : entitlements.plan ? null : PLANS.solo;
    const limit = entitlements.limits.socialAccounts ?? PLANS.solo.limits.socialAccounts;
    throw new UserFacingError(
      "account_limit",
      `Your plan includes ${limit} connected accounts. Upgrade to connect more.`,
      { label: "See plans", href: "/app/billing" },
      {
        title: `You've connected all ${limit} accounts your plan includes`,
        body: "Disconnect one you no longer post to, or upgrade to connect more.",
        currentPlan: entitlements.plan ? PLANS[entitlements.plan].name : null,
        next: next ? { id: next.id, name: next.name, offer: `${next.limits.socialAccounts === null ? "Unlimited" : next.limits.socialAccounts} connected accounts, $${next.priceMonthlyUsd}/month` } : null,
      },
    );
  }
}

export type ConnectStart = { kind: "session"; token: string; attemptId: string } | { kind: "credentials"; attemptId: string };

/**
 * Begin connecting a network. Nango networks get a short-lived Connect UI
 * token (opened in the browser); Bluesky asks for a handle and app password.
 * The account is stored only once the network confirms it.
 */
export async function startConnection(userId: string, platform: Platform): Promise<ConnectStart> {
  const availability = (await networkAvailability())[platform];
  if (!availability.available) throw new UserFacingError("platform_not_enabled", availability.reason);
  await assertCanConnect(userId);

  const admin = createAdminClient();
  const before = (await listConnectedAccounts(userId)).filter((a) => a.platform === platform).map((a) => a.external_account_id);
  const { data: attempt, error } = await admin
    .from("social_connection_attempts")
    .insert({ user_id: userId, platform, accounts_before: before })
    .select("id")
    .single();
  if (error || !attempt) throw new Error("Could not record the connection attempt.");

  if (availability.method === "credentials") return { kind: "credentials", attemptId: attempt.id };
  try {
    const token = await nango.connectSessionToken(userId, platform);
    if (!token) throw new UserFacingError("platform_not_enabled", `${PLATFORM_META[platform].name} is being set up. Your other networks work as normal.`);
    return { kind: "session", token, attemptId: attempt.id };
  } catch (error) {
    const userError = toUserError(error, platform, "connect");
    await markAttempt(attempt.id, "failed", userError?.code ?? "unknown_error", userError?.message ?? "The connection could not be started.");
    log.warn("connect start failed", { operation: "social.startConnection", userId, provider: "nango", platform }, error);
    throw userError ?? error;
  }
}

/** The browser says Nango's Connect UI finished: ask Nango what this user now has connected. */
export async function completeConnection(userId: string, attemptId: string) {
  const attempt = await loadPendingAttempt(userId, attemptId);
  const platform = attempt.platform as Platform;
  let accounts: ProviderAccount[];
  try {
    accounts = (await nangoAccounts(userId)).filter((a) => a.platform === platform);
  } catch (error) {
    const userError = toUserError(error, platform, "connect");
    await markAttempt(attempt.id, "failed", userError?.code, userError?.message);
    throw userError ?? error;
  }
  if (!accounts.length) {
    await markAttempt(attempt.id, "failed", "no_account", `No ${PLATFORM_META[platform].name} account was connected.`);
    throw new UserFacingError("no_account", `No ${PLATFORM_META[platform].name} account was connected. Try again.`);
  }
  const saved = await upsertAccounts(userId, accounts, "nango");
  await markAttempt(attempt.id, "completed");
  return saved;
}

const BlueskyHandle = /^@?[a-z0-9.-]+\.[a-z]{2,}$|^did:plc:[a-z0-9]+$/i;
const AppPassword = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i;

/** Bluesky: sign in once with the app password to prove it works, then store it encrypted. */
export async function connectBluesky(userId: string, attemptId: string, input: { identifier: string; appPassword: string }) {
  const attempt = await loadPendingAttempt(userId, attemptId);
  if (attempt.platform !== "bluesky") throw new UserFacingError("invalid", "That connection attempt isn't for Bluesky.");
  const identifier = input.identifier.trim();
  const appPassword = input.appPassword.trim();
  if (!BlueskyHandle.test(identifier)) throw new UserFacingError("invalid", "Enter your Bluesky handle, like name.bsky.social.");
  if (!AppPassword.test(appPassword)) {
    throw new UserFacingError("invalid", "That isn't an app password. Make one on Bluesky in Settings → Privacy and security → App passwords. It looks like xxxx-xxxx-xxxx-xxxx.");
  }
  let account: ProviderAccount;
  try {
    const session = await bluesky.signIn({ identifier, appPassword });
    const who = await bluesky.profile(session);
    account = { externalId: who.id, platform: "bluesky", displayName: `@${who.username}`, platformAccountId: who.id, metadata: { name: who.name, username: who.username, picture: who.avatar } };
  } catch (error) {
    const userError = toUserError(error, "bluesky", "connect");
    await markAttempt(attempt.id, "failed", userError?.code, userError?.message);
    throw userError ?? error;
  }
  const [saved] = await upsertAccounts(userId, [account], "bluesky");
  await saveCredential(userId, saved.id, { identifier, appPassword });
  bluesky.forgetSession(saved.id);
  await markAttempt(attempt.id, "completed");
  return [saved];
}

async function loadPendingAttempt(userId: string, attemptId: string) {
  const { data: attempt } = await createAdminClient().from("social_connection_attempts").select("*").eq("id", attemptId).eq("user_id", userId).maybeSingle();
  if (!attempt) throw new UserFacingError("not_found", "That connection attempt wasn't found.");
  if (attempt.status !== "pending") throw new UserFacingError("attempt_closed", "That connection attempt has already finished.");
  if (Date.now() - new Date(attempt.created_at).getTime() > CONNECT_ATTEMPT_TTL_MS) {
    await markAttempt(attemptId, "expired", "expired", "The connection took too long. Start again.");
    throw new UserFacingError("attempt_expired", "The connection took too long. Start again.");
  }
  return attempt;
}

async function markAttempt(attemptId: string, status: "completed" | "failed" | "expired", code?: string | null, message?: string | null) {
  await createAdminClient()
    .from("social_connection_attempts")
    .update({ status, error_code: code ?? null, error_message: message ?? null, completed_at: new Date().toISOString() })
    .eq("id", attemptId);
}

/** This user's Nango connections (tagged with their id at connect time), with each network's profile. */
async function nangoAccounts(userId: string): Promise<ProviderAccount[]> {
  if (!integrations.nango()) return [];
  const connections = await nango.listConnections(userId);
  return Promise.all(
    connections.map(async (c): Promise<ProviderAccount> => {
      const target = { connectionId: c.connectionId, providerConfigKey: c.providerConfigKey };
      const who = c.broken ? null : await publishers.profile(c.platform, target).catch(() => null);
      return {
        externalId: nango.packAccountId(target),
        platform: c.platform,
        displayName: who?.username ? `@${who.username}` : (who?.name ?? null),
        platformAccountId: who?.id ?? c.connectionId,
        needsReconnect: c.broken || who === null,
        metadata: { name: who?.name ?? null, username: who?.username ?? null, picture: who?.avatar ?? null, nangoProvider: c.provider },
      };
    }),
  );
}

async function upsertAccounts(userId: string, accounts: ProviderAccount[], provider: ConnectionKind) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const saved: SocialAccount[] = [];
  for (const account of accounts) {
    const { data: existing } = await admin.from("social_accounts").select("id,user_id").eq("provider", provider).eq("external_account_id", account.externalId).maybeSingle();
    if (existing && existing.user_id !== userId) {
      log.error("account already owned by another user", { operation: "social.upsertAccounts", userId, provider, resourceId: account.externalId });
      throw new UserFacingError("account_conflict", "That account is already connected to a different Postory workspace. Disconnect it there first.");
    }
    const meta = account.metadata as { name?: string | null; username?: string | null; picture?: string | null };
    const handle = meta.username ? `@${meta.username.replace(/^@/, "")}` : null;
    const row = {
      user_id: userId,
      provider,
      platform: account.platform,
      display_name: meta.name ?? account.displayName,
      username: handle ?? account.displayName,
      profile_image_url: meta.picture && /^https:\/\//.test(meta.picture) ? meta.picture : null,
      external_account_id: account.externalId,
      status: account.needsReconnect ? "reconnect_required" : "connected",
      last_synced_at: now,
      metadata: { ...account.metadata, platformAccountId: account.platformAccountId },
    };
    const query = existing ? admin.from("social_accounts").update({ ...row, connected_at: now }).eq("id", existing.id) : admin.from("social_accounts").insert(row);
    const { data, error } = await query.select("*").single();
    if (error || !data) throw new Error("Could not save the connected account.");
    saved.push(data);
  }
  return saved;
}

/** Refresh account state. Accounts that stopped working are flagged (and the user emailed), never deleted. */
export async function syncAccounts(userId: string) {
  let remote: ProviderAccount[];
  try {
    remote = await nangoAccounts(userId);
  } catch (error) {
    throw toUserError(error, undefined, "sync") ?? error;
  }
  const admin = createAdminClient();
  const local = await listConnectedAccounts(userId);
  const { data: disconnected } = await admin.from("social_accounts").select("external_account_id").eq("user_id", userId).eq("status", "disconnected");
  const dropped = new Set((disconnected ?? []).map((r) => r.external_account_id));
  // Don't resurrect accounts the user disconnected in Postory.
  const toSave = remote.filter((a) => !dropped.has(a.externalId));
  if (toSave.length) await upsertAccounts(userId, toSave, "nango");

  const remoteIds = new Set(remote.map((a) => a.externalId));
  const missing = local.filter((a) => a.provider === "nango" && !remoteIds.has(a.external_account_id));
  // Bluesky: check the stored app password still signs in.
  for (const account of local.filter((a) => a.provider === "bluesky" && a.status === "connected")) {
    const ok = await blueskySession(userId, account).then(() => true).catch((e) => !(e instanceof SocialProviderError && e.code === "platform_auth_failed"));
    if (!ok) missing.push(account);
  }
  if (missing.length) {
    const { data: broken } = await admin
      .from("social_accounts")
      .update({ status: "reconnect_required", last_synced_at: new Date().toISOString() })
      .in("id", missing.map((a) => a.id))
      .eq("status", "connected")
      .select("platform");
    for (const platform of new Set((broken ?? []).map((a) => a.platform))) {
      notifyUser(userId, "connectionIssue", { network: PLATFORM_META[platform as Platform]?.name ?? platform });
    }
  }
  return listConnectedAccounts(userId);
}

/**
 * Stop using an account. Its posts stay in the library. The token is deleted
 * at Nango (or the stored app password deleted) so Postory can't use it again.
 */
export async function disconnectAccount(userId: string, socialAccountId: string) {
  const admin = createAdminClient();
  const { data: account } = await admin.from("social_accounts").select("*").eq("id", socialAccountId).eq("user_id", userId).maybeSingle();
  if (!account) throw new UserFacingError("not_found", "That account isn't connected to your workspace.");

  let providerRevoked = false;
  try {
    if (account.provider === "nango") {
      const t = nango.unpackAccountId(account.external_account_id);
      await nango.deleteConnection(t.connectionId, t.providerConfigKey);
    } else if (account.provider === "bluesky") {
      await deleteCredential(userId, account.id);
      bluesky.forgetSession(account.id);
    }
    providerRevoked = true;
  } catch (error) {
    log.warn("disconnect not completed at provider", { operation: "social.disconnect", userId, provider: account.provider, resourceId: account.id }, error);
  }

  const { error } = await admin
    .from("social_accounts")
    .update({ status: "disconnected", metadata: { ...(account.metadata as object), providerRevoked } })
    .eq("id", account.id)
    .eq("user_id", userId);
  if (error) throw new Error("Could not update the account.");
  return { providerRevoked };
}

async function blueskySession(userId: string, account: SocialAccount) {
  const login = await readCredential(userId, account.id);
  if (!login?.identifier || !login.appPassword) throw new SocialProviderError("platform_auth_failed", "Reconnect Bluesky.");
  return bluesky.signIn({ identifier: login.identifier, appPassword: login.appPassword }, account.id);
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

async function loadOwnedPost(userId: string, postId: string) {
  const { data: post } = await createAdminClient().from("story_posts").select("*").eq("id", postId).eq("user_id", userId).maybeSingle();
  if (!post) throw new UserFacingError("not_found", "That post wasn't found.");
  if (!isPostStatus(post.status)) throw new Error(`Unknown post status ${post.status}`);
  return post as StoryPost & { status: PostStatus };
}

async function loadPublishTarget(userId: string, post: StoryPost) {
  const name = PLATFORM_META[post.platform as Platform]?.name ?? post.platform;
  if (!PLATFORM_META[post.platform as Platform]?.can.publish) {
    throw new UserFacingError("platform_not_enabled", PLATFORM_META[post.platform as Platform]?.limitation ?? `Postory can't publish to ${name}.`);
  }
  if (!post.social_account_id) throw new UserFacingError("no_account", `Choose which ${name} account to use before publishing.`, { label: "Connect an account", href: "/app/connections" });
  const { data: account } = await createAdminClient().from("social_accounts").select("*").eq("id", post.social_account_id).eq("user_id", userId).maybeSingle();
  if (!account || account.status === "disconnected") {
    throw new UserFacingError("no_account", "The account for this post is no longer connected. Choose another account.", { label: "Connections", href: "/app/connections" });
  }
  if (account.status === "reconnect_required") {
    throw new UserFacingError("reconnect_required", `${name} needs to be reconnected before Postory can post to it.`, { label: `Reconnect ${name}`, href: "/app/connections" });
  }
  if (account.platform !== post.platform) throw new UserFacingError("platform_mismatch", "This account is for a different network.");
  return account;
}

function assertContentValid(post: StoryPost, media: PostMedia[]) {
  const issues = validatePostContent(post.platform as Platform, post.content, media).filter((i) => i.level === "error");
  if (issues.length) throw new UserFacingError("invalid_content", issues.map((i) => i.message).join(" "));
}

/** The post's first image, as a short-lived signed URL (networks fetch it) and its type. */
async function firstImage(userId: string, media: PostMedia[]) {
  const item = media.find((m) => m.kind === "image");
  if (!item) return null;
  if (!item.storagePath.startsWith(`${userId}/`)) throw new UserFacingError("invalid_media", "A media file on this post isn't yours.");
  const { data, error } = await createAdminClient().storage.from(MEDIA_BUCKET).createSignedUrl(item.storagePath, 60 * 60);
  if (error || !data?.signedUrl) throw new UserFacingError("media_missing", "The image on this post couldn't be found. Remove it and add it again.");
  return { url: data.signedUrl, contentType: item.contentType, alt: item.altText ?? "" };
}

/** Send one post to its network. Throws SocialProviderError / UserFacingError on failure. */
async function sendToNetwork(userId: string, post: StoryPost, account: SocialAccount): Promise<Published> {
  const media = parseMedia(post.media);
  if (media.some((m) => m.kind === "video")) throw new UserFacingError("video_unsupported", "Postory publishes text and images. Remove the video, or post it from the network's app.");
  const image = await firstImage(userId, media);
  const platform = post.platform as Platform;
  if (account.provider === "bluesky") {
    const session = await blueskySession(userId, account);
    let bytes: { bytes: Buffer; contentType: string; alt: string } | null = null;
    if (image) {
      const res = await fetch(image.url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (!res?.ok) throw new UserFacingError("media_missing", "Postory couldn't read the image to upload it. Try again.");
      bytes = { bytes: Buffer.from(await res.arrayBuffer()), contentType: image.contentType, alt: image.alt };
    }
    return bluesky.publish(session, post.content, bytes);
  }
  if (account.provider !== "nango") throw new UserFacingError("reconnect_required", "Reconnect this account to keep posting.", { label: "Connections", href: "/app/connections" });
  return publishers.publish(platform, nango.unpackAccountId(account.external_account_id), post.content, image?.url ?? null);
}

async function markPublished(post: StoryPost, published: Published) {
  const { data } = await createAdminClient()
    .from("story_posts")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      external_post_id: published.postId,
      platform_post_id: published.postId,
      external_url: published.url && /^https?:\/\//.test(published.url) ? published.url : null,
      error_code: null,
      error_message: null,
    })
    .eq("id", post.id)
    .select("*")
    .single();
  return data!;
}

async function markFailed(post: StoryPost, error: unknown, operation: "publish" | "schedule") {
  const userError = toUserError(error, post.platform, operation);
  const message = userError?.message ?? "Publishing failed. Nothing was posted. Try again.";
  await createAdminClient()
    .from("story_posts")
    .update({ status: "failed", error_code: userError?.code ?? "unknown_error", error_message: message })
    .eq("id", post.id);
  return { userError, message };
}

/**
 * Publish a post right now. The compare-and-set claim means only one request
 * ever sends it; a failure leaves it "failed" with a reason and a safe retry.
 */
export async function publishNow(userId: string, postId: string) {
  const post = await loadOwnedPost(userId, postId);
  if (post.status === "published") return post;
  if (post.status !== "approved" && post.status !== "failed") {
    throw new UserFacingError("invalid_state", post.status === "scheduled" ? "This post is scheduled. Unschedule it first to publish now." : "Approve this post before publishing it.");
  }
  assertTransition(post.status, "publishing");
  const entitlements = await getEntitlements(userId);
  assertActivePlan(entitlements);
  const account = await loadPublishTarget(userId, post);
  assertContentValid(post, parseMedia(post.media));

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("story_posts")
    .update({ status: "publishing", publish_attempts: post.publish_attempts + 1, error_code: null, error_message: null, scheduled_for: null })
    .eq("id", post.id)
    .eq("user_id", userId)
    .in("status", ["approved", "failed"])
    .select("*")
    .maybeSingle();
  if (!claimed) throw new UserFacingError("already_publishing", "This post is already being published.");

  const credits =
    post.platform === "x"
      ? await consumeUsage(userId, entitlements, "x_credit", X_CREDITS_PER_POST).catch(async (e) => {
          await admin.from("story_posts").update({ status: post.status }).eq("id", post.id);
          throw e;
        })
      : null;

  try {
    return await markPublished(post, await sendToNetwork(userId, claimed, account));
  } catch (error) {
    const outcomeUnknown = error instanceof SocialProviderError && error.options.outcomeUnknown;
    if (!outcomeUnknown) await credits?.release();
    const { userError } = await markFailed(post, error, "publish");
    log.error("publish failed", { operation: "social.publishNow", userId, provider: account.provider, resourceId: post.id, platform: post.platform }, error);
    throw userError ?? new UserFacingError("publish_failed", "Publishing failed. Nothing was posted. Try again.");
  }
}

const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;

/** Put an approved post on Postory's schedule. The scheduler sends it at that time. */
export async function schedulePost(userId: string, postId: string, when: Date) {
  if (when.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) throw new UserFacingError("invalid_time", "Pick a time at least a couple of minutes from now.");
  const post = await loadOwnedPost(userId, postId);
  if (post.status === "scheduled") return reschedulePost(userId, postId, when);
  if (post.status !== "approved" && post.status !== "failed") throw new UserFacingError("invalid_state", "Approve this post before scheduling it.");
  assertTransition(post.status, "scheduled");
  assertActivePlan(await getEntitlements(userId));
  await loadPublishTarget(userId, post);
  assertContentValid(post, parseMedia(post.media));

  const { data } = await createAdminClient()
    .from("story_posts")
    .update({ status: "scheduled", scheduled_for: when.toISOString(), external_post_id: null, error_code: null, error_message: null })
    .eq("id", post.id)
    .eq("user_id", userId)
    .in("status", ["approved", "failed"])
    .select("*")
    .maybeSingle();
  if (!data) throw new UserFacingError("already_publishing", "This post is already being processed.");
  return data;
}

export async function reschedulePost(userId: string, postId: string, when: Date): Promise<StoryPost> {
  if (when.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) throw new UserFacingError("invalid_time", "Pick a time at least a couple of minutes from now.");
  const post = await loadOwnedPost(userId, postId);
  if (post.status !== "scheduled") throw new UserFacingError("invalid_state", "Only scheduled posts can be moved.");
  const { data } = await createAdminClient()
    .from("story_posts")
    .update({ scheduled_for: when.toISOString() })
    .eq("id", post.id)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  if (!data) throw new UserFacingError("too_late", "This post has already started publishing, so it can't be moved.");
  return data;
}

export async function unschedulePost(userId: string, postId: string) {
  const post = await loadOwnedPost(userId, postId);
  if (post.status !== "scheduled") throw new UserFacingError("invalid_state", "This post isn't scheduled.");
  const { data } = await createAdminClient()
    .from("story_posts")
    .update({ status: "approved", scheduled_for: null })
    .eq("id", post.id)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .select("*")
    .maybeSingle();
  if (!data) throw new UserFacingError("too_late", "This post has already started publishing, so it can't be unscheduled.");
  return data;
}

/**
 * Posts left in "publishing" by an interrupted run (a deploy mid-send) are
 * marked failed with an honest message, since Postory can't know whether the
 * network received them. Cheap enough to run on page loads.
 */
export async function reconcileDuePosts(userId: string) {
  const { data } = await createAdminClient()
    .from("story_posts")
    .update({
      status: "failed",
      error_code: "outcome_unknown",
      error_message: "Publishing was interrupted, so Postory can't tell whether it went out. Check the network before retrying, so it doesn't post twice.",
    })
    .eq("user_id", userId)
    .eq("status", "publishing")
    .lt("updated_at", new Date(Date.now() - STUCK_PUBLISHING_MS).toISOString())
    .select("id");
  return data?.length ?? 0;
}

/**
 * Postory's scheduler: sends every scheduled post whose time has come. Each
 * post is claimed with a compare-and-set, the plan and account are checked at
 * send time, and failures email the owner.
 */
export async function publishDueScheduledPosts(limit = 20) {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("story_posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  let sent = 0;
  for (const post of due ?? []) {
    const { data: claimed } = await admin
      .from("story_posts")
      .update({ status: "publishing", publish_attempts: post.publish_attempts + 1 })
      .eq("id", post.id)
      .eq("status", "scheduled")
      .select("*")
      .maybeSingle();
    if (!claimed) continue;

    let credits: Awaited<ReturnType<typeof consumeUsage>> | null = null;
    try {
      const entitlements = await getEntitlements(post.user_id);
      if (!entitlements.active) throw new UserFacingError("plan_required", "Your Postory plan has ended, so this scheduled post wasn't sent. Choose a plan, then publish it.", { label: "See plans", href: "/app/billing" });
      const account = await loadPublishTarget(post.user_id, post);
      if (post.platform === "x") credits = await consumeUsage(post.user_id, entitlements, "x_credit", X_CREDITS_PER_POST);
      await markPublished(post, await sendToNetwork(post.user_id, claimed, account));
      sent += 1;
    } catch (error) {
      const outcomeUnknown = error instanceof SocialProviderError && error.options.outcomeUnknown;
      if (!outcomeUnknown) await credits?.release();
      const { message } = await markFailed(post, error, "publish");
      log.error("scheduled publish failed", { operation: "social.publishDue", userId: post.user_id, resourceId: post.id, platform: post.platform }, error);
      notifyUser(post.user_id, "publishFailed", { network: PLATFORM_META[post.platform as Platform]?.name ?? post.platform, reason: message, storyId: post.story_id });
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Engagement: metrics and comments, read back only where the network allows
// ---------------------------------------------------------------------------

type PublishedRow = { id: string; story_id: string; platform: string; platform_post_id: string; social_account_id: string };

async function recentPublished(userId: string, options: { syncedBefore?: string; platforms: Platform[]; days: number; limit: number }) {
  let query = createAdminClient()
    .from("story_posts")
    .select("id,story_id,platform,platform_post_id,social_account_id,metrics_synced_at")
    .eq("user_id", userId)
    .eq("status", "published")
    .in("platform", options.platforms)
    .not("platform_post_id", "is", null)
    .not("social_account_id", "is", null)
    .gte("published_at", new Date(Date.now() - options.days * 86_400_000).toISOString())
    .order("published_at", { ascending: false })
    .limit(options.limit);
  if (options.syncedBefore) query = query.or(`metrics_synced_at.is.null,metrics_synced_at.lt.${options.syncedBefore}`);
  const { data } = await query;
  return (data ?? []) as unknown as PublishedRow[];
}

async function accountsById(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, SocialAccount>();
  const { data } = await createAdminClient().from("social_accounts").select("*").eq("user_id", userId).in("id", [...new Set(ids)]).eq("status", "connected");
  return new Map((data ?? []).map((a) => [a.id, a]));
}

/**
 * Read engagement back for recent published posts, at most every two hours
 * per post. Never throws: analytics render with whatever is already stored.
 */
export async function syncPostMetrics(userId: string) {
  try {
    const platforms = PLATFORMS.filter((p) => PLATFORM_META[p].can.metrics);
    const rows = await recentPublished(userId, { syncedBefore: new Date(Date.now() - 2 * 3_600_000).toISOString(), platforms, days: 60, limit: 40 });
    if (!rows.length) return;
    const accounts = await accountsById(userId, rows.map((r) => r.social_account_id));
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // One batch per account.
    const byAccount = new Map<string, PublishedRow[]>();
    for (const r of rows) byAccount.set(r.social_account_id, [...(byAccount.get(r.social_account_id) ?? []), r]);
    for (const [accountId, posts] of byAccount) {
      const account = accounts.get(accountId);
      if (!account) continue;
      let stats: Record<string, PostMetrics> = {};
      try {
        stats =
          account.provider === "bluesky"
            ? await bluesky.metrics(await blueskySession(userId, account), posts.map((p) => p.platform_post_id))
            : await publishers.metrics(account.platform as Platform, nango.unpackAccountId(account.external_account_id), posts.map((p) => p.platform_post_id));
      } catch (error) {
        log.warn("metrics read failed", { operation: "social.metrics", userId, provider: account.provider, platform: account.platform }, error);
      }
      await Promise.all(
        posts.map((p) =>
          admin.from("story_posts").update({ metrics_synced_at: now, ...(stats[p.platform_post_id] ? { metrics: stats[p.platform_post_id] } : {}) }).eq("id", p.id).eq("user_id", userId),
        ),
      );
    }
  } catch (error) {
    log.warn("metrics sync failed", { operation: "social.metrics", userId }, error);
  }
}

let inboxSyncedAt = new Map<string, number>();

/**
 * Pull comments on posts Postory published in the last two weeks into the
 * inbox, from networks whose API shares them. At most every five minutes per
 * user; never throws.
 */
export async function syncInbox(userId: string) {
  const last = inboxSyncedAt.get(userId) ?? 0;
  if (Date.now() - last < 5 * 60_000) return;
  if (inboxSyncedAt.size > 5000) inboxSyncedAt = new Map();
  inboxSyncedAt.set(userId, Date.now());
  try {
    const platforms = PLATFORMS.filter((p) => PLATFORM_META[p].can.comments);
    const rows = await recentPublished(userId, { platforms, days: 14, limit: 25 });
    if (!rows.length) return;
    const accounts = await accountsById(userId, rows.map((r) => r.social_account_id));
    const admin = createAdminClient();
    for (const post of rows) {
      const account = accounts.get(post.social_account_id);
      if (!account) continue;
      let found: RemoteComment[] = [];
      try {
        found =
          account.provider === "bluesky"
            ? await bluesky.replies(await blueskySession(userId, account), post.platform_post_id)
            : await publishers.comments(account.platform as Platform, nango.unpackAccountId(account.external_account_id), post.platform_post_id);
      } catch (error) {
        log.warn("comments read failed", { operation: "social.inbox", userId, provider: account.provider, platform: account.platform }, error);
        continue;
      }
      if (!found.length) continue;
      await admin.from("inbox_items").upsert(
        found
          .filter((c) => c.text.trim())
          .map((c) => ({
            user_id: userId,
            social_account_id: account.id,
            story_post_id: post.id,
            platform: account.platform,
            kind: "comment",
            author_name: c.authorName,
            author_handle: c.authorHandle,
            content: c.text.slice(0, 5000),
            external_id: c.id,
            external_url: c.url,
            received_at: c.createdAt,
            context: c.context as Json,
          })),
        { onConflict: "user_id,platform,external_id", ignoreDuplicates: true },
      );
    }
  } catch (error) {
    log.warn("inbox sync failed", { operation: "social.inbox", userId }, error);
  }
}

/** Send an approved reply to a comment, from the account the original post went out on. */
export async function sendInboxReply(userId: string, itemId: string, text: string) {
  const admin = createAdminClient();
  const { data: item } = await admin.from("inbox_items").select("*").eq("id", itemId).eq("user_id", userId).maybeSingle();
  if (!item) throw new UserFacingError("not_found", "That conversation wasn't found.");
  if (item.reply_status === "sent") throw new UserFacingError("already_sent", "You've already replied to this.");
  const platform = item.platform as Platform;
  if (!PLATFORM_META[platform]?.can.comments || !item.social_account_id) throw new UserFacingError("platform_not_enabled", "Replying on this network isn't available. Copy the reply and post it there.");
  const { data: account } = await admin.from("social_accounts").select("*").eq("id", item.social_account_id).eq("user_id", userId).maybeSingle();
  if (!account || account.status !== "connected") throw new UserFacingError("reconnect_required", "Reconnect this account to reply from Postory.", { label: "Connections", href: "/app/connections" });

  const { data: claimed } = await admin.from("inbox_items").update({ reply_status: "sending" }).eq("id", item.id).neq("reply_status", "sent").neq("reply_status", "sending").select("id").maybeSingle();
  if (!claimed) throw new UserFacingError("already_sending", "This reply is already being sent.");
  try {
    if (account.provider === "bluesky") {
      const ctx = item.context as { root?: { uri: string; cid: string }; parent?: { uri: string; cid: string } };
      if (!ctx.root || !ctx.parent) throw new UserFacingError("reply_unavailable", "Postory can't reply to this one. Reply on Bluesky instead.");
      await bluesky.publish(await blueskySession(userId, account), text, null, { root: ctx.root, parent: ctx.parent });
    } else {
      await publishers.reply(platform, nango.unpackAccountId(account.external_account_id), item.external_id, text);
    }
  } catch (error) {
    const outcomeUnknown = error instanceof SocialProviderError && error.options.outcomeUnknown;
    await admin.from("inbox_items").update({ reply_status: "failed" }).eq("id", item.id);
    if (outcomeUnknown) throw new UserFacingError("outcome_unknown", `Postory couldn't confirm the reply with ${PLATFORM_META[platform].name}. Check there before sending it again.`);
    throw toUserError(error, platform, "publish") ?? new UserFacingError("reply_failed", "The reply wasn't sent. Try again.");
  }
  await admin.from("inbox_items").update({ reply_status: "sent", reply_draft: text, category: "replied", replied_at: new Date().toISOString() }).eq("id", item.id);
}
