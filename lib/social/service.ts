import "server-only";

/**
 * Postory's social service. The only place application code goes to connect
 * accounts, publish or schedule. Provider specifics stay in ./letmepost.ts.
 *
 * Invariants
 *   - A social_accounts row exists only for an account the provider reports as
 *     connected inside this user's isolated workspace. Nothing is marked
 *     connected because a button was clicked.
 *   - A post is only marked published/scheduled after the provider confirms.
 *   - Publishing is guarded by a compare-and-set status update plus the
 *     provider Idempotency-Key, so the same post can't go out twice.
 */

import { env, integrations } from "@/lib/env";
import { describeSocialError, UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeUsage, getEntitlements, assertActivePlan, canConnectAnotherAccount } from "@/lib/entitlements";
import { PLANS, X_CREDITS_PER_POST } from "@/lib/billing/plans";
import { MEDIA_BUCKET, parseMedia, type PostMedia } from "@/lib/posts/media";
import { assertTransition, isPostStatus, type PostStatus } from "@/lib/posts/state-machine";
import { PLATFORM_META, validatePostContent, type Platform } from "./platforms";
import * as letmepost from "./letmepost";
import { SocialProviderError, type ProviderAccount, type ProviderPostStatus } from "./types";
import type { Tables } from "@/types/database";

type StoryPost = Tables<"story_posts">;
type SocialAccount = Tables<"social_accounts">;

const CONNECT_ATTEMPT_TTL_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export type SocialReadiness =
  | { ready: true; workspaceId: string }
  | { ready: false; reason: "provider_not_configured" | "workspace_not_linked"; message: string };

export async function getSocialReadiness(userId: string): Promise<SocialReadiness> {
  if (!integrations.letmepost()) {
    return {
      ready: false,
      reason: "provider_not_configured",
      message: "Social publishing isn't configured on this Postory deployment yet (LETMEPOST_API_KEY is missing).",
    };
  }
  const workspace = await getWorkspaceId(userId);
  if (!workspace) {
    return {
      ready: false,
      reason: "workspace_not_linked",
      message:
        "Your Postory workspace hasn't been linked to a publishing workspace yet. We provision these by hand while publishing is in early access — we'll email you when yours is ready.",
    };
  }
  return { ready: true, workspaceId: workspace };
}

async function getWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_workspaces")
    .select("external_profile_id")
    .eq("user_id", userId)
    .eq("provider", "letmepost")
    .maybeSingle();
  return data?.external_profile_id ?? null;
}

async function requireWorkspace(userId: string) {
  const readiness = await getSocialReadiness(userId);
  if (!readiness.ready) throw new UserFacingError(readiness.reason, readiness.message);
  return readiness.workspaceId;
}

function toUserError(error: unknown, platform: string | undefined, operation: "connect" | "publish" | "schedule" | "sync") {
  if (error instanceof UserFacingError) return error;
  if (error instanceof SocialProviderError) {
    const described = describeSocialError(error.code, {
      platform: platform ?? error.options.platform,
      message: error.message,
      remediation: error.options.remediation,
      operation,
    });
    return new UserFacingError(described.code, described.message, described.action);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function listConnectedAccounts(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("social_accounts")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "disconnected")
    .order("connected_at", { ascending: true });
  return data ?? [];
}

/**
 * Begin connecting a network. Records an attempt, then asks LetMePost for the
 * network's consent URL. The account is only stored once the provider reports
 * it in completeConnection().
 */
export async function startConnection(userId: string, platform: Platform, returnPath: string) {
  const workspaceId = await requireWorkspace(userId);

  const [entitlements, existing] = await Promise.all([getEntitlements(userId), listConnectedAccounts(userId)]);
  const connectedCount = existing.filter((a) => a.status !== "disconnected").length;
  // Before a plan is chosen (during onboarding) allow up to the Solo allowance.
  const allowed = entitlements.active
    ? canConnectAnotherAccount(entitlements, connectedCount)
    : connectedCount < (PLANS.solo.limits.socialAccounts ?? 0);
  if (!allowed) {
    throw new UserFacingError(
      "account_limit",
      `Your plan includes ${entitlements.limits.socialAccounts ?? PLANS.solo.limits.socialAccounts} connected accounts. Upgrade to connect more.`,
      { label: "See plans", href: "/app/billing" },
    );
  }

  const admin = createAdminClient();
  let before: ProviderAccount[] = [];
  try {
    before = await letmepost.listAccounts(workspaceId);
  } catch (error) {
    throw toUserError(error, platform, "connect") ?? error;
  }

  const { data: attempt, error: insertError } = await admin
    .from("social_connection_attempts")
    .insert({ user_id: userId, platform, accounts_before: before.map((a) => a.externalId) })
    .select("id")
    .single();
  if (insertError || !attempt) throw new Error("Could not record the connection attempt.");

  const returnTo = `${env.appUrl()}/api/social/callback?attempt=${attempt.id}&next=${encodeURIComponent(returnPath)}`;

  try {
    const descriptor = await letmepost.startConnect(platform, { profileId: workspaceId, returnTo });
    if (descriptor.availability === "pending") {
      throw new SocialProviderError("platform_not_enabled", "Not enabled yet.");
    }
    return { attemptId: attempt.id, descriptor };
  } catch (error) {
    const userError = toUserError(error, platform, "connect");
    await admin
      .from("social_connection_attempts")
      .update({
        status: "failed",
        error_code: userError?.code ?? "unknown_error",
        error_message: userError?.message ?? "The connection could not be started.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", attempt.id);
    log.warn("connect start failed", { operation: "social.startConnection", userId, provider: "letmepost", platform }, error);
    throw userError ?? error;
  }
}

/** Bluesky-style credential connections. */
export async function completeCredentialsConnection(userId: string, attemptId: string, fields: Record<string, string>) {
  const attempt = await loadPendingAttempt(userId, attemptId);
  const workspaceId = await requireWorkspace(userId);
  try {
    await letmepost.completeCredentialsConnect(attempt.platform as Platform, { profileId: workspaceId, fields });
  } catch (error) {
    const userError = toUserError(error, attempt.platform, "connect");
    await markAttempt(attemptId, "failed", userError?.code, userError?.message);
    throw userError ?? error;
  }
  return reconcileAttempt(userId, attempt, workspaceId);
}

/**
 * Called when the browser returns from LetMePost. Trusts nothing in the URL
 * except the attempt id: success is determined by asking LetMePost which
 * accounts now exist in this user's workspace.
 */
export async function completeConnection(userId: string, attemptId: string, providerError: string | null) {
  const attempt = await loadPendingAttempt(userId, attemptId);
  if (providerError) {
    const message =
      providerError === "access_denied" || providerError === "user_denied"
        ? "The connection was cancelled on the network's consent screen."
        : "The network didn't complete the connection. Try again.";
    await markAttempt(attemptId, "failed", providerError, message);
    throw new UserFacingError("connect_failed", message);
  }
  const workspaceId = await requireWorkspace(userId);
  return reconcileAttempt(userId, attempt, workspaceId);
}

async function loadPendingAttempt(userId: string, attemptId: string) {
  const admin = createAdminClient();
  const { data: attempt } = await admin
    .from("social_connection_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!attempt) throw new UserFacingError("not_found", "That connection attempt wasn't found.");
  if (attempt.status !== "pending") throw new UserFacingError("attempt_closed", "That connection attempt has already finished.");
  if (Date.now() - new Date(attempt.created_at).getTime() > CONNECT_ATTEMPT_TTL_MS) {
    await markAttempt(attemptId, "expired", "expired", "The connection took too long. Start again.");
    throw new UserFacingError("attempt_expired", "The connection took too long. Start again.");
  }
  return attempt;
}

async function markAttempt(attemptId: string, status: "completed" | "failed" | "expired", code?: string | null, message?: string | null) {
  const admin = createAdminClient();
  await admin
    .from("social_connection_attempts")
    .update({ status, error_code: code ?? null, error_message: message ?? null, completed_at: new Date().toISOString() })
    .eq("id", attemptId);
}

async function reconcileAttempt(userId: string, attempt: Tables<"social_connection_attempts">, workspaceId: string) {
  const platform = attempt.platform as Platform;
  let accounts: ProviderAccount[];
  try {
    accounts = await letmepost.listAccounts(workspaceId);
  } catch (error) {
    const userError = toUserError(error, platform, "connect");
    await markAttempt(attempt.id, "failed", userError?.code, userError?.message);
    throw userError ?? error;
  }

  const before = new Set(attempt.accounts_before);
  const forPlatform = accounts.filter((a) => a.platform === platform && a.externalProfileId === workspaceId);
  const fresh = forPlatform.filter((a) => !before.has(a.externalId));
  // Reconnecting an existing account rotates its token without creating a new id.
  const touched = fresh.length > 0 ? fresh : forPlatform;

  if (touched.length === 0) {
    await markAttempt(attempt.id, "failed", "no_account", `No ${PLATFORM_META[platform].name} account was connected.`);
    throw new UserFacingError("no_account", `No ${PLATFORM_META[platform].name} account was connected. Try again.`);
  }

  const saved = await upsertAccounts(userId, touched);
  await markAttempt(attempt.id, "completed");
  return saved;
}

async function upsertAccounts(userId: string, accounts: ProviderAccount[]) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const saved: SocialAccount[] = [];
  for (const account of accounts) {
    const { data: existing } = await admin
      .from("social_accounts")
      .select("id,user_id")
      .eq("provider", "letmepost")
      .eq("external_account_id", account.externalId)
      .maybeSingle();

    if (existing && existing.user_id !== userId) {
      // Workspaces are per-user, so this indicates a provisioning mistake.
      log.error("provider account already owned by another user", {
        operation: "social.upsertAccounts",
        userId,
        provider: "letmepost",
        resourceId: account.externalId,
      });
      throw new UserFacingError("account_conflict", "That account is already connected to a different Postory workspace.");
    }

    const expired = account.tokenExpiresAt ? new Date(account.tokenExpiresAt) < new Date() : false;
    const row = {
      user_id: userId,
      provider: "letmepost",
      platform: account.platform,
      display_name: account.displayName,
      username: account.displayName,
      external_account_id: account.externalId,
      status: expired ? "reconnect_required" : "connected",
      last_synced_at: now,
      metadata: { ...account.metadata, platformAccountId: account.platformAccountId, tokenExpiresAt: account.tokenExpiresAt },
    };

    const query = existing
      ? admin.from("social_accounts").update({ ...row, connected_at: now }).eq("id", existing.id)
      : admin.from("social_accounts").insert(row);
    const { data, error } = await query.select("*").single();
    if (error || !data) throw new Error("Could not save the connected account.");
    saved.push(data);
  }
  return saved;
}

/**
 * Refresh local account state from the provider. Accounts the provider no
 * longer reports are flagged, never silently deleted.
 */
export async function syncAccounts(userId: string) {
  const workspaceId = await requireWorkspace(userId);
  let accounts: ProviderAccount[];
  try {
    accounts = (await letmepost.listAccounts(workspaceId)).filter((a) => a.externalProfileId === workspaceId);
  } catch (error) {
    throw toUserError(error, undefined, "sync") ?? error;
  }

  const admin = createAdminClient();
  const local = await listConnectedAccounts(userId);
  const remoteIds = new Set(accounts.map((a) => a.externalId));
  const disconnectedLocally = new Set(
    (
      await admin.from("social_accounts").select("external_account_id").eq("user_id", userId).eq("status", "disconnected")
    ).data?.map((r) => r.external_account_id) ?? [],
  );

  // Don't resurrect accounts the user explicitly disconnected in Postory.
  const toSave = accounts.filter((a) => !disconnectedLocally.has(a.externalId));
  if (toSave.length) await upsertAccounts(userId, toSave);

  const missing = local.filter((a) => !remoteIds.has(a.external_account_id));
  if (missing.length) {
    await admin
      .from("social_accounts")
      .update({ status: "reconnect_required", last_synced_at: new Date().toISOString() })
      .in("id", missing.map((a) => a.id));
  }
  return listConnectedAccounts(userId);
}

/**
 * Stop using an account in Postory. Historical posts are kept (their
 * social_account_id stays, status is untouched). We also ask the provider to
 * drop its token; if the provider only allows that from its own dashboard we
 * say so instead of pretending.
 */
export async function disconnectAccount(userId: string, socialAccountId: string) {
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("social_accounts")
    .select("*")
    .eq("id", socialAccountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!account) throw new UserFacingError("not_found", "That account isn't connected to your workspace.");

  let providerRevoked = false;
  if (integrations.letmepost()) {
    try {
      await letmepost.disconnectAccount(account.external_account_id);
      providerRevoked = true;
    } catch (error) {
      log.warn("provider disconnect not completed", {
        operation: "social.disconnect",
        userId,
        provider: "letmepost",
        resourceId: account.external_account_id,
      }, error);
    }
  }

  const { error } = await admin
    .from("social_accounts")
    .update({ status: "disconnected", metadata: { ...(account.metadata as object), providerRevoked } })
    .eq("id", account.id)
    .eq("user_id", userId);
  if (error) throw new Error("Could not update the account.");

  return { providerRevoked };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

async function loadOwnedPost(userId: string, postId: string) {
  const admin = createAdminClient();
  const { data: post } = await admin.from("story_posts").select("*").eq("id", postId).eq("user_id", userId).maybeSingle();
  if (!post) throw new UserFacingError("not_found", "That post wasn't found.");
  if (!isPostStatus(post.status)) throw new Error(`Unknown post status ${post.status}`);
  return post as StoryPost & { status: PostStatus };
}

async function loadPublishTarget(userId: string, post: StoryPost) {
  if (!post.social_account_id) {
    throw new UserFacingError(
      "no_account",
      `Choose which ${PLATFORM_META[post.platform as Platform].name} account to use before publishing.`,
    );
  }
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("social_accounts")
    .select("*")
    .eq("id", post.social_account_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!account || account.status === "disconnected") {
    throw new UserFacingError("no_account", "The account for this post is no longer connected. Choose another account.");
  }
  if (account.status === "reconnect_required") {
    const name = PLATFORM_META[account.platform as Platform].name;
    throw new UserFacingError("reconnect_required", `${name} needs to be reconnected before Postory can post to it.`, {
      label: `Reconnect ${name}`,
      href: "/app/settings#accounts",
    });
  }
  if (account.platform !== post.platform) throw new UserFacingError("platform_mismatch", "This account is for a different network.");
  return account;
}

function assertContentValid(post: StoryPost, media: PostMedia[]) {
  const issues = validatePostContent(post.platform as Platform, post.content, media).filter((i) => i.level === "error");
  if (issues.length) throw new UserFacingError("invalid_content", issues.map((i) => i.message).join(" "));
}

/** Upload stored media to the provider once; cache the provider media id on the post. */
async function prepareMedia(userId: string, post: StoryPost, media: PostMedia[], workspaceId: string) {
  if (media.length === 0) return [];
  const admin = createAdminClient();
  const prepared: PostMedia[] = [];
  for (const item of media) {
    if (!item.storagePath.startsWith(`${userId}/`)) throw new UserFacingError("invalid_media", "A media file on this post isn't yours.");
    if (item.providerMediaId) {
      prepared.push(item);
      continue;
    }
    const { data: file, error } = await admin.storage.from(MEDIA_BUCKET).download(item.storagePath);
    if (error || !file) throw new UserFacingError("media_missing", "A media file on this post couldn't be found. Remove it and try again.");
    const uploaded = await letmepost.uploadMedia({
      bytes: await file.arrayBuffer(),
      filename: item.storagePath.split("/").pop() ?? "media",
      contentType: item.contentType,
      profileId: workspaceId,
    });
    prepared.push({ ...item, providerMediaId: uploaded.mediaId });
  }
  await admin.from("story_posts").update({ media: prepared }).eq("id", post.id).eq("user_id", userId);
  return prepared;
}

function providerStatusToPostStatus(status: ProviderPostStatus): PostStatus {
  switch (status) {
    case "published":
      return "published";
    case "queued":
    case "validated":
      return "scheduled";
    case "publishing":
      return "publishing";
    case "canceled":
      return "approved";
    default:
      return "failed";
  }
}

function webUrl(uri: string | null) {
  return uri && /^https?:\/\//.test(uri) ? uri : null;
}

/**
 * Publish a post right now. Safe to retry: the status compare-and-set blocks
 * concurrent clicks, and the stored Idempotency-Key makes LetMePost replay its
 * original answer instead of posting again.
 */
export async function publishNow(userId: string, postId: string) {
  const post = await loadOwnedPost(userId, postId);
  if (post.status === "published") return post;
  if (post.status !== "approved" && post.status !== "failed") {
    throw new UserFacingError("invalid_state", post.status === "scheduled"
      ? "This post is scheduled. Unschedule it first to publish now."
      : "Approve this post before publishing it.");
  }
  assertTransition(post.status, "publishing");

  const workspaceId = await requireWorkspace(userId);
  const entitlements = await getEntitlements(userId);
  assertActivePlan(entitlements);
  const account = await loadPublishTarget(userId, post);
  const media = parseMedia(post.media);
  assertContentValid(post, media);

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("story_posts")
    .update({ status: "publishing", publish_attempts: post.publish_attempts + 1, error_code: null, error_message: null })
    .eq("id", post.id)
    .eq("user_id", userId)
    .in("status", ["approved", "failed"])
    .select("*")
    .maybeSingle();
  if (!claimed) throw new UserFacingError("already_publishing", "This post is already being published.");

  const credits = post.platform === "x" ? await consumeUsage(userId, entitlements, "x_credit", X_CREDITS_PER_POST).catch(async (e) => {
    await admin.from("story_posts").update({ status: post.status }).eq("id", post.id);
    throw e;
  }) : null;

  try {
    const prepared = await prepareMedia(userId, post, media, workspaceId);
    const result = await letmepost.createPost({
      accountExternalId: account.external_account_id,
      platform: post.platform as Platform,
      text: post.content,
      media: prepared.map((m) => ({ kind: m.kind, mediaId: m.providerMediaId!, altText: m.altText })),
      externalProfileId: workspaceId,
      idempotencyKey: post.idempotency_key,
    });

    if (result.status === "published") {
      const { data } = await admin
        .from("story_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          external_post_id: result.externalPostId,
          external_url: webUrl(result.uri),
          provider_batch_id: result.batchId,
        })
        .eq("id", post.id)
        .select("*")
        .single();
      return data!;
    }

    // Definitive failure: the provider answered. A new key makes the next try a fresh attempt.
    await credits?.release();
    const described = describeSocialError(result.error?.code ?? "platform_rejected", {
      platform: post.platform,
      message: result.error?.message,
      remediation: result.error?.remediation,
      operation: "publish",
    });
    await admin
      .from("story_posts")
      .update({
        status: providerStatusToPostStatus(result.status) === "published" ? "published" : "failed",
        error_code: described.code,
        error_message: described.message,
        external_post_id: result.externalPostId,
        provider_batch_id: result.batchId,
        idempotency_key: crypto.randomUUID(),
      })
      .eq("id", post.id);
    throw new UserFacingError(described.code, described.message, described.action);
  } catch (error) {
    if (error instanceof UserFacingError) throw error;
    const outcomeUnknown = error instanceof SocialProviderError && error.options.outcomeUnknown;
    if (!outcomeUnknown) await credits?.release();
    const userError = toUserError(error, post.platform, "publish");
    await admin
      .from("story_posts")
      .update({
        status: "failed",
        error_code: userError?.code ?? "unknown_error",
        error_message: userError?.message ?? "Publishing failed. Try again.",
        // Keep the key when we don't know the outcome so a retry is deduplicated.
        ...(outcomeUnknown ? {} : { idempotency_key: crypto.randomUUID() }),
      })
      .eq("id", post.id);
    log.error("publish failed", { operation: "social.publishNow", userId, provider: "letmepost", resourceId: post.id, platform: post.platform }, error);
    throw userError ?? new UserFacingError("publish_failed", "Publishing failed. Try again.");
  }
}

const MIN_SCHEDULE_LEAD_MS = 2 * 60 * 1000;

/**
 * Queue a post at the provider for a future time. LetMePost executes
 * scheduled posts itself; it currently accepts text-only scheduled posts, so
 * posts with media must be published now instead.
 */
export async function schedulePost(userId: string, postId: string, when: Date) {
  if (when.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
    throw new UserFacingError("invalid_time", "Pick a time at least a couple of minutes from now.");
  }
  const post = await loadOwnedPost(userId, postId);
  if (post.status === "scheduled") return reschedulePost(userId, postId, when);
  if (post.status !== "approved" && post.status !== "failed") {
    throw new UserFacingError("invalid_state", "Approve this post before scheduling it.");
  }
  assertTransition(post.status, "scheduled");

  const media = parseMedia(post.media);
  if (media.length > 0) {
    throw new UserFacingError(
      "media_schedule_unsupported",
      "Posts with images or video can't be scheduled through the publishing provider yet. Publish it now, or remove the media to schedule it.",
    );
  }

  const workspaceId = await requireWorkspace(userId);
  const entitlements = await getEntitlements(userId);
  assertActivePlan(entitlements);
  const account = await loadPublishTarget(userId, post);
  assertContentValid(post, media);

  const admin = createAdminClient();
  const { data: claimed } = await admin
    .from("story_posts")
    .update({ status: "publishing", error_code: null, error_message: null })
    .eq("id", post.id)
    .eq("user_id", userId)
    .in("status", ["approved", "failed"])
    .select("id")
    .maybeSingle();
  if (!claimed) throw new UserFacingError("already_publishing", "This post is already being processed.");

  const credits = post.platform === "x" ? await consumeUsage(userId, entitlements, "x_credit", X_CREDITS_PER_POST).catch(async (e) => {
    await admin.from("story_posts").update({ status: post.status }).eq("id", post.id);
    throw e;
  }) : null;

  try {
    const result = await letmepost.createPost({
      accountExternalId: account.external_account_id,
      platform: post.platform as Platform,
      text: post.content,
      media: [],
      scheduledAt: when,
      externalProfileId: workspaceId,
      idempotencyKey: post.idempotency_key,
    });
    if (result.status !== "queued" && result.status !== "validated") {
      throw new SocialProviderError(result.error?.code ?? "platform_rejected", result.error?.message ?? "The post wasn't queued.", {
        remediation: result.error?.remediation,
      });
    }
    const { data } = await admin
      .from("story_posts")
      .update({
        status: "scheduled",
        scheduled_for: when.toISOString(),
        external_post_id: result.externalPostId,
        provider_batch_id: result.batchId,
      })
      .eq("id", post.id)
      .select("*")
      .single();
    return data!;
  } catch (error) {
    const outcomeUnknown = error instanceof SocialProviderError && error.options.outcomeUnknown;
    if (!outcomeUnknown) await credits?.release();
    const userError = toUserError(error, post.platform, "schedule");
    await admin
      .from("story_posts")
      .update({
        status: post.status === "failed" ? "failed" : "approved",
        error_code: userError?.code ?? "unknown_error",
        error_message: userError?.message ?? "Scheduling failed.",
        ...(outcomeUnknown ? {} : { idempotency_key: crypto.randomUUID() }),
      })
      .eq("id", post.id);
    log.warn("schedule failed", { operation: "social.schedulePost", userId, provider: "letmepost", resourceId: post.id }, error);
    throw userError ?? new UserFacingError("schedule_failed", "Scheduling failed. Try again.");
  }
}

export async function reschedulePost(userId: string, postId: string, when: Date) {
  if (when.getTime() < Date.now() + MIN_SCHEDULE_LEAD_MS) {
    throw new UserFacingError("invalid_time", "Pick a time at least a couple of minutes from now.");
  }
  const post = await loadOwnedPost(userId, postId);
  if (post.status !== "scheduled" || !post.external_post_id) {
    throw new UserFacingError("invalid_state", "Only scheduled posts can be moved.");
  }
  await requireWorkspace(userId);
  try {
    await letmepost.reschedulePost(post.external_post_id, when);
  } catch (error) {
    if (error instanceof SocialProviderError && error.status === 409) {
      await refreshPostFromProvider(userId, post);
      throw new UserFacingError("too_late", "This post has already started publishing, so it can't be moved.");
    }
    throw toUserError(error, post.platform, "schedule") ?? error;
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("story_posts")
    .update({ scheduled_for: when.toISOString() })
    .eq("id", post.id)
    .eq("user_id", userId)
    .select("*")
    .single();
  return data!;
}

export async function unschedulePost(userId: string, postId: string) {
  const post = await loadOwnedPost(userId, postId);
  if (post.status !== "scheduled") throw new UserFacingError("invalid_state", "This post isn't scheduled.");
  await requireWorkspace(userId);
  if (post.external_post_id) {
    try {
      await letmepost.cancelPost(post.external_post_id);
    } catch (error) {
      if (error instanceof SocialProviderError && error.status === 409) {
        await refreshPostFromProvider(userId, post);
        throw new UserFacingError("too_late", "This post has already started publishing, so it can't be unscheduled.");
      }
      throw toUserError(error, post.platform, "schedule") ?? error;
    }
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("story_posts")
    .update({
      status: "approved",
      scheduled_for: null,
      external_post_id: null,
      provider_batch_id: null,
      idempotency_key: crypto.randomUUID(),
    })
    .eq("id", post.id)
    .eq("user_id", userId)
    .select("*")
    .single();
  return data!;
}

async function refreshPostFromProvider(userId: string, post: StoryPost) {
  if (!post.external_post_id) return post;
  const remote = await letmepost.getPost(post.external_post_id);
  const next = providerStatusToPostStatus(remote.status);
  const admin = createAdminClient();
  const update: Partial<StoryPost> = { status: next };
  if (next === "published") {
    update.published_at = remote.publishedAt ?? new Date().toISOString();
    update.external_url = webUrl(remote.uri);
  }
  if (next === "failed") {
    const described = describeSocialError(remote.error?.code ?? "platform_rejected", {
      platform: post.platform,
      message: remote.error?.message,
      operation: "publish",
    });
    update.error_code = described.code;
    update.error_message = described.message;
    update.idempotency_key = crypto.randomUUID();
  }
  if (next === "approved") {
    update.scheduled_for = null;
    update.external_post_id = null;
  }
  const { data } = await admin.from("story_posts").update(update).eq("id", post.id).eq("user_id", userId).select("*").single();
  return data ?? post;
}

/**
 * Scheduled posts are executed by LetMePost. When the user looks at their
 * content we reconcile anything whose time has passed, so the calendar and
 * library show what really happened. Bounded to keep page loads fast.
 */
export async function reconcileDuePosts(userId: string, limit = 15) {
  if (!integrations.letmepost()) return 0;
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("story_posts")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["scheduled", "publishing"])
    .not("external_post_id", "is", null)
    .lte("scheduled_for", new Date(Date.now() - 30_000).toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  let changed = 0;
  for (const post of due ?? []) {
    try {
      const updated = await refreshPostFromProvider(userId, post);
      if (updated.status !== post.status) changed += 1;
    } catch (error) {
      log.warn("reconcile failed", { operation: "social.reconcileDuePosts", userId, provider: "letmepost", resourceId: post.id }, error);
    }
  }
  return changed;
}
