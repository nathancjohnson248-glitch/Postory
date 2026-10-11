/**
 * Pure entitlement logic (no I/O) so it can be unit-tested exhaustively.
 * The rest of the app asks "what may this user do?" through getEntitlements()
 * in ./index.ts — never `if (plan === "pro")` in components.
 */
import { PLANS, isPlanId, type PlanFeatures, type PlanId, type PlanLimits } from "@/lib/billing/plans";

export type SubscriptionState = {
  plan: string | null;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

export type EntitlementSource = "subscription" | "development_override" | "none";

export type Entitlements = {
  active: boolean;
  plan: PlanId | null;
  status: string | null;
  source: EntitlementSource;
  trialing: boolean;
  trialEndsAt: Date | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Start of the window usage is counted in. */
  usagePeriodStart: Date;
  reason?: "no_subscription" | "trial_ended" | "subscription_inactive";
};

const RENEWAL_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

const NO_LIMITS: PlanLimits = { socialAccounts: 0, aiGenerations: 0, aiConversations: 0, aiImages: 0, xCredits: 0 };
const NO_FEATURES: PlanFeatures = {
  approvalWorkflow: true,
  calendar: true,
  businessMemory: true,
  unifiedInbox: false,
  advancedAnalytics: false,
  advancedPlanning: false,
};

export function startOfUtcMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Usage resets each billing period; fall back to the calendar month. */
export function usagePeriodStart(sub: SubscriptionState, now: Date): Date {
  const start = sub?.current_period_start ? new Date(sub.current_period_start) : null;
  if (start && !Number.isNaN(start.getTime()) && start <= now) {
    // A period can't be longer than ~a month; guard against stale data.
    const monthAgo = new Date(now.getTime() - 32 * 24 * 60 * 60 * 1000);
    return start < monthAgo ? startOfUtcMonth(now) : start;
  }
  return startOfUtcMonth(now);
}

export function resolveEntitlements(input: {
  subscription: SubscriptionState;
  now: Date;
  devPlan?: string;
}): Entitlements {
  const { subscription: sub, now, devPlan } = input;

  if (devPlan && isPlanId(devPlan)) {
    const plan = PLANS[devPlan];
    return {
      active: true,
      plan: plan.id,
      status: "development",
      source: "development_override",
      trialing: false,
      trialEndsAt: null,
      limits: plan.limits,
      features: plan.features,
      usagePeriodStart: startOfUtcMonth(now),
    };
  }

  const inactive = (reason: Entitlements["reason"]): Entitlements => ({
    active: false,
    plan: sub && isPlanId(sub.plan) ? sub.plan : null,
    status: sub?.status ?? null,
    source: sub ? "subscription" : "none",
    trialing: false,
    trialEndsAt: sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null,
    limits: NO_LIMITS,
    features: NO_FEATURES,
    usagePeriodStart: usagePeriodStart(sub, now),
    reason,
  });

  if (!sub || !isPlanId(sub.plan)) return inactive("no_subscription");

  const plan = PLANS[sub.plan];
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const trialEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at) : null;

  let active = false;
  let trialing = false;
  let reason: Entitlements["reason"];

  switch (sub.status) {
    case "trialing":
      trialing = true;
      active = !trialEnd || trialEnd > now;
      if (!active) reason = "trial_ended";
      break;
    case "active":
      // Small grace window for renewals that haven't been read back yet.
      active = !periodEnd || periodEnd.getTime() + RENEWAL_GRACE_MS > now.getTime();
      if (!active) reason = "subscription_inactive";
      break;
    case "past_due": // the provider is still retrying payment
      active = true;
      break;
    case "canceled":
      // Cancelled at period end keeps access until the paid period runs out.
      active = Boolean(periodEnd && periodEnd > now);
      if (!active) reason = "subscription_inactive";
      break;
    default:
      reason = "subscription_inactive";
  }

  if (!active) return inactive(reason);

  return {
    active: true,
    plan: plan.id,
    status: sub.status,
    source: "subscription",
    trialing,
    trialEndsAt: trialEnd,
    limits: plan.limits,
    features: plan.features,
    usagePeriodStart: usagePeriodStart(sub, now),
  };
}

export function canConnectAnotherAccount(entitlements: Entitlements, connectedCount: number) {
  if (!entitlements.active) return false;
  const limit = entitlements.limits.socialAccounts;
  return limit === null || connectedCount < limit;
}
