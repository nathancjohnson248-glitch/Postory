import "server-only";

/**
 * Billing orchestration. HandyPay is the source of truth; the subscriptions
 * table mirrors the last state Postory read from HandyPay's API. A browser
 * claiming "payment successful" changes nothing — only a provider read does.
 */

import { env } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { BillingUnavailableError, handypay, type ProviderSubscription } from "./handypay";
import { PLANS, TRIAL_DAYS, type PlanId } from "./plans";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;

export type BillingAvailability = {
  configured: boolean;
  checkout: boolean;
  changePlan: boolean;
  cancel: boolean;
  manage: boolean;
};

export function billingAvailability(): BillingAvailability {
  return {
    configured: handypay.isConfigured(),
    checkout: handypay.canCheckout(),
    changePlan: handypay.supports("changePlan"),
    cancel: handypay.supports("cancelSubscription"),
    manage: handypay.supports("getManagementUrl"),
  };
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

async function saveProviderSubscription(userId: string, sub: ProviderSubscription) {
  const admin = createAdminClient();
  const row = {
    user_id: userId,
    provider: "handypay",
    plan: sub.plan,
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
  if (error) throw new Error("Could not save subscription state.");
  return data;
}

/** Start a HandyPay checkout for a plan. Returns the hosted checkout URL. */
export async function startCheckout(user: { id: string; email: string | null }, plan: PlanId, returnPath: string) {
  const existing = await getSubscriptionRow(user.id);
  if (existing && ["trialing", "active", "past_due"].includes(existing.status) && existing.provider_subscription_id) {
    throw new UserFacingError("already_subscribed", "You already have a subscription. Change plans from Billing.", {
      label: "Open billing",
      href: "/app/billing",
    });
  }
  // One trial per customer.
  const trialDays = existing?.trial_ends_at ? 0 : TRIAL_DAYS;

  const admin = createAdminClient();
  const { data: event, error } = await admin
    .from("billing_events")
    .insert({ user_id: user.id, kind: "checkout", plan, status: "started", detail: { trialDays } })
    .select("id")
    .single();
  if (error || !event) throw new Error("Could not start checkout.");

  try {
    const safeReturn = returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/app/billing";
    const session = await handypay.createCheckout({
      plan,
      priceMonthlyUsd: PLANS[plan].priceMonthlyUsd,
      trialDays,
      customerEmail: user.email,
      clientReference: event.id,
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
    .eq("kind", "checkout")
    .maybeSingle();
  if (!event?.provider_reference) return { status: "unknown" as const };
  if (event.status === "completed") return { status: "completed" as const };

  try {
    const sub = await handypay.getCheckoutResult(event.provider_reference);
    if (!sub) return { status: "pending" as const };
    await saveProviderSubscription(userId, sub);
    await admin.from("billing_events").update({ status: "completed" }).eq("id", event.id);
    return { status: "completed" as const, subscription: sub };
  } catch (e) {
    log.warn("checkout reconcile failed", { operation: "billing.reconcileCheckout", userId, provider: "handypay", resourceId: eventId }, e);
    throw toUserError(e);
  }
}

/** Refresh the local mirror from HandyPay (rate-limited unless forced). */
export async function syncSubscription(userId: string, options: { force?: boolean } = {}) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id || !handypay.supports("getSubscription")) return row;
  const fresh = row.last_synced_at && Date.now() - new Date(row.last_synced_at).getTime() < SYNC_INTERVAL_MS;
  if (fresh && !options.force) return row;
  try {
    const sub = await handypay.getSubscription(row.provider_subscription_id);
    return await saveProviderSubscription(userId, sub);
  } catch (e) {
    log.warn("subscription sync failed", { operation: "billing.syncSubscription", userId, provider: "handypay" }, e);
    return row;
  }
}

export async function changePlan(userId: string, plan: PlanId) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id) throw new UserFacingError("no_subscription", "Start a subscription first.");
  if (row.plan === plan) return row;
  const admin = createAdminClient();
  try {
    const sub = await handypay.changePlan(row.provider_subscription_id, plan);
    await admin.from("billing_events").insert({ user_id: userId, kind: "plan_change", plan, status: "completed", provider_reference: sub.reference });
    return await saveProviderSubscription(userId, sub);
  } catch (e) {
    await admin.from("billing_events").insert({ user_id: userId, kind: "plan_change", plan, status: "failed" });
    throw toUserError(e);
  }
}

/** Cancel through HandyPay. User content is never deleted by a cancellation. */
export async function cancelSubscription(userId: string) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id) throw new UserFacingError("no_subscription", "There's no active subscription to cancel.");
  const admin = createAdminClient();
  try {
    const sub = await handypay.cancelSubscription(row.provider_subscription_id);
    await admin.from("billing_events").insert({ user_id: userId, kind: "cancel", status: "completed", provider_reference: sub.reference });
    return await saveProviderSubscription(userId, sub);
  } catch (e) {
    await admin.from("billing_events").insert({ user_id: userId, kind: "cancel", status: "failed" });
    throw toUserError(e);
  }
}

export async function getManagementUrl(userId: string) {
  const row = await getSubscriptionRow(userId);
  if (!row?.provider_subscription_id) return null;
  try {
    return await handypay.getManagementUrl(row.provider_subscription_id);
  } catch (e) {
    throw toUserError(e);
  }
}
