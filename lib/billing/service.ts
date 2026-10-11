import "server-only";

/**
 * Billing orchestration. HandyPay is the source of truth; the subscriptions
 * table mirrors the last state Postory read from HandyPay's API. A browser
 * claiming "payment successful" changes nothing — only a provider read does.
 *
 * No webhooks: state is read back (1) when the browser returns from checkout,
 * (2) when the billing page loads, and (3) whenever entitlements are checked
 * and the mirror is stale or a period boundary has passed.
 */

import { env } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingUnavailableError, handypay, type ProviderSubscription } from "./handypay";
import { PLANS, TRIAL_DAYS, isPlanId, type PlanId } from "./plans";
import type { Tables } from "@/types/database";

type SubscriptionRow = Tables<"subscriptions">;

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const LIVE_STATUSES = ["trialing", "active", "past_due"];

export type BillingAvailability = { configured: boolean; checkout: boolean; changePlan: boolean; cancel: boolean; manage: boolean };

export function billingAvailability(): BillingAvailability {
  const configured = handypay.isConfigured();
  return { configured, checkout: configured, changePlan: configured, cancel: configured, manage: configured };
}

function toUserError(error: unknown) {
  if (error instanceof BillingUnavailableError) return new UserFacingError(`billing_${error.code}`, error.message);
  return error;
}

export async function getSubscriptionRow(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("subscriptions").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

async function saveProviderSubscription(userId: string, sub: ProviderSubscription, fallbackPlan?: string | null) {
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    provider: "handypay",
    plan: sub.plan ?? (isPlanId(fallbackPlan) ? fallbackPlan : null),
    status: sub.status,
    provider_subscription_id: sub.reference,
    provider_customer_id: sub.customerReference,
    trial_ends_at: sub.trialEndsAt?.toISOString() ?? null,
    current_period_start: sub.currentPeriodStart?.toISOString() ?? null,
    current_period_end: sub.currentPeriodEnd?.toISOString() ?? null,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
    canceled_at: sub.canceledAt?.toISOString() ?? null,
    last_synced_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" }).select("*").single();
  if (error || !data) {
    log.error("subscription save failed", { operation: "billing.save", userId, provider: "handypay" }, error);
    throw new Error("Could not save subscription state.");
  }
  return data;
}

/**
 * Start a HandyPay subscription checkout. Returns the hosted checkout URL.
 * If the user already has a live subscription this is a plan change: the new
 * checkout has no trial, and the old subscription is cancelled once HandyPay
 * confirms the new one (see reconcileCheckout).
 */
export async function startCheckout(user: { id: string; email: string | null }, plan: PlanId, returnPath: string) {
  const existing = await getSubscriptionRow(user.id);
  const live = existing && LIVE_STATUSES.includes(existing.status) && existing.provider_subscription_id;
  if (live && existing.plan === plan) {
    throw new UserFacingError("already_on_plan", `You're already on ${PLANS[plan].name}.`);
  }
  // One trial per customer, and never on a plan change.
  const trialDays = existing ? 0 : TRIAL_DAYS;

  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from("billing_events")
    .insert({
      user_id: user.id,
      kind: live ? "plan_change" : "checkout",
      plan,
      status: "started",
      detail: { trialDays, replaces: live ? existing.provider_subscription_id : null },
    })
    .select("id")
    .single();
  if (error || !event) throw new Error("Could not start checkout.");

  const safeReturn = returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/app/billing";
  try {
    const session = await handypay.createCheckout({
      plan,
      trialDays,
      customerEmail: user.email,
      customerReference: existing?.provider_customer_id ?? null,
      clientReference: event.id,
      userId: user.id,
      successUrl: `${env.appUrl()}/api/billing/return?event=${event.id}&next=${encodeURIComponent(safeReturn)}`,
      cancelUrl: `${env.appUrl()}${safeReturn}${safeReturn.includes("?") ? "&" : "?"}checkout=canceled`,
    });
    await admin.from("billing_events").update({ provider_reference: session.reference }).eq("id", event.id);
    return session.url;
  } catch (e) {
    await admin
      .from("billing_events")
      .update({ status: "failed", detail: { trialDays, error: e instanceof Error ? e.message : "unknown" } })
      .eq("id", event.id);
    log.warn("checkout start failed", { operation: "billing.startCheckout", userId: user.id, provider: "handypay" }, e);
    throw toUserError(e);
  }
}

/**
 * The browser came back from HandyPay. Ask HandyPay what actually happened —
 * the return URL itself proves nothing.
 */
export async function reconcileCheckout(userId: string, eventId: string) {
  const admin = createAdminClient();
  const { data: event } = await admin
    .from("billing_events")
    .select("*")
    .eq("id", eventId)
    .eq("user_id", userId)
    .in("kind", ["checkout", "plan_change"])
    .maybeSingle();
  if (!event?.provider_reference) return { status: "unknown" as const };
  if (event.status === "completed") return { status: "completed" as const };

  try {
    const outcome = await handypay.getCheckoutOutcome(event.provider_reference);
    if (outcome.state === "open") return { status: "pending" as const };
    if (outcome.state === "expired") {
      await admin.from("billing_events").update({ status: "failed", detail: { ...(event.detail as object), reason: "expired" } }).eq("id", event.id);
      return { status: "expired" as const };
    }

    const sub = await handypay.getSubscription(outcome.subscriptionReference, isPlanId(event.plan) ? event.plan : null);
    const saved = await saveProviderSubscription(userId, sub, event.plan);

    // Plan change: retire the previous subscription now that the new one exists.
    const replaces = (event.detail as { replaces?: string | null } | null)?.replaces;
    if (replaces && replaces !== sub.reference) {
      try {
        await handypay.cancelSubscription(replaces, { atPeriodEnd: false });
      } catch (e) {
        log.error("failed to cancel replaced subscription", { operation: "billing.planChange", userId, provider: "handypay", resourceId: replaces }, e);
      }
    }

    await admin.from("billing_events").update({ status: "completed" }).eq("id", event.id);
    return { status: "completed" as const, subscription: sub, row: saved };
  } catch (e) {
    log.warn("checkout reconcile failed", { operation: "billing.reconcileCheckout", userId, provider: "handypay", resourceId: eventId }, e);
    throw toUserError(e);
  }
}

/** Is the local mirror stale enough that entitlements should re-read HandyPay? */
export function needsSync(row: Pick<SubscriptionRow, "provider_subscription_id" | "status" | "last_synced_at" | "trial_ends_at" | "current_period_end">, now = new Date()) {
  if (!row.provider_subscription_id) return false;
  if (!["trialing", "active", "past_due", "incomplete"].includes(row.status)) return false;
  const synced = row.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
  if (now.getTime() - synced > STALE_AFTER_MS) return true;
  // A trial or billing period ended since we last looked.
  const boundaries = [row.trial_ends_at, row.current_period_end].filter(Boolean).map((d) => new Date(d as string).getTime());
  return boundaries.some((b) => b <= now.getTime() && b > synced);
}

/** Refresh the local mirror from HandyPay (rate-limited unless forced). */
export async function syncSubscription(userId: string, options: { force?: boolean } = {}) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id || !handypay.isConfigured()) return row;
  const fresh = row.last_synced_at && Date.now() - new Date(row.last_synced_at).getTime() < SYNC_INTERVAL_MS;
  if (fresh && !options.force) return row;
  try {
    const sub = await handypay.getSubscription(row.provider_subscription_id, isPlanId(row.plan) ? row.plan : null);
    return await saveProviderSubscription(userId, sub, row.plan);
  } catch (e) {
    log.warn("subscription sync failed", { operation: "billing.syncSubscription", userId, provider: "handypay" }, e);
    return row;
  }
}

/** Cancel at the end of the paid period. User content is never deleted by a cancellation. */
export async function cancelSubscription(userId: string) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id) throw new UserFacingError("no_subscription", "There's no active subscription to cancel.");
  const admin = createAdminClient();
  try {
    await handypay.cancelSubscription(row.provider_subscription_id, { atPeriodEnd: true });
    const sub = await handypay.getSubscription(row.provider_subscription_id, isPlanId(row.plan) ? row.plan : null);
    await admin.from("billing_events").insert({ user_id: userId, kind: "cancel", status: "completed", provider_reference: sub.reference, plan: row.plan });
    return await saveProviderSubscription(userId, sub, row.plan);
  } catch (e) {
    await admin.from("billing_events").insert({ user_id: userId, kind: "cancel", status: "failed", plan: row.plan });
    throw toUserError(e);
  }
}

/** Undo a scheduled cancellation. */
export async function resumeSubscription(userId: string) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id || !row.cancel_at_period_end) {
    throw new UserFacingError("not_cancelling", "Your subscription isn't scheduled to cancel.");
  }
  try {
    await handypay.resumeSubscription(row.provider_subscription_id);
    const sub = await handypay.getSubscription(row.provider_subscription_id, isPlanId(row.plan) ? row.plan : null);
    return await saveProviderSubscription(userId, sub, row.plan);
  } catch (e) {
    throw toUserError(e);
  }
}

/** HandyPay-hosted page where the customer updates their card or cancels. */
export async function getManagementUrl(userId: string) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id) return null;
  try {
    return await handypay.createPortalSession(row.provider_subscription_id, `${env.appUrl()}/app/billing`);
  } catch (e) {
    throw toUserError(e);
  }
}
