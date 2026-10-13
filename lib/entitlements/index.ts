import "server-only";

import { cache } from "react";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { METRIC_LABEL, METRIC_LIMIT_KEY, PLANS, type PlanId, type UsageMetric } from "@/lib/billing/plans";
import type { Upgrade } from "@/lib/errors";
import { needsSync, syncSubscription } from "@/lib/billing/service";
import { isOwnerEmail } from "@/lib/auth/admin";
import { resolveEntitlements, type Entitlements } from "./resolve";

export type { Entitlements } from "./resolve";
export { canConnectAnotherAccount } from "./resolve";

/** Server-side entitlement lookup. The plan is never taken from the client. */
export const getEntitlements = cache(async (userId: string): Promise<Entitlements> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan,status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,provider_subscription_id,last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  // No webhooks: if the mirror is stale or a trial/period just ended, re-read HandyPay first.
  const subscription = data && needsSync(data) ? ((await syncSubscription(userId, { force: true })) ?? data) : data;
  return resolveEntitlements({ subscription, now: new Date(), devPlan: env.devPlan(), owner: await isVerifiedOwner(userId) });
});

/** The owner, by confirmed email read server-side from Auth — never from the browser. */
const isVerifiedOwner = cache(async (userId: string) => {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    return Boolean(data.user?.email_confirmed_at && isOwnerEmail(data.user.email));
  } catch {
    return false;
  }
});

export class EntitlementError extends Error {
  constructor(
    public readonly code: "no_plan" | "limit_reached" | "feature_unavailable",
    message: string,
    public readonly upgrade?: Upgrade,
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

const ORDER: PlanId[] = ["solo", "pro", "max"];

function nextPlan(plan: PlanId | null) {
  const id = plan ? ORDER[ORDER.indexOf(plan) + 1] : "solo";
  return id ? PLANS[id] : null;
}

/** The upgrade modal's content for a used-up metric, from the real plan limits. */
export function limitUpgrade(entitlements: Entitlements, metric: UsageMetric): Upgrade {
  const key = METRIC_LIMIT_KEY[metric];
  const label = METRIC_LABEL[metric];
  const current = entitlements.plan ? PLANS[entitlements.plan] : null;
  const next = nextPlan(entitlements.plan);
  return {
    title: `You've used all your ${label} for this period`,
    body: `${current ? `${current.name} includes ${entitlements.limits[key]} ${label} each billing period.` : ""} They come back when your next period starts${next ? `, or straight away if you upgrade` : ""}.`.trim(),
    currentPlan: current?.name ?? null,
    next: next ? { id: next.id, name: next.name, offer: `${next.limits[key]} ${label} a period, $${next.priceMonthlyUsd}/month` } : null,
  };
}

/** The upgrade modal's content for a feature the current plan doesn't include. */
export function featureUpgrade(entitlements: Entitlements, label: string): Upgrade {
  const next = nextPlan(entitlements.plan);
  return {
    title: `${label} comes with ${next?.name ?? "Pro"}`,
    body: `${label} isn't part of ${entitlements.plan ? PLANS[entitlements.plan].name : "your plan"}.`,
    currentPlan: entitlements.plan ? PLANS[entitlements.plan].name : null,
    next: next ? { id: next.id, name: next.name, offer: `${label}, plus ${next.limits.aiGenerations} AI post generations a period, $${next.priceMonthlyUsd}/month` } : null,
  };
}

export function assertActivePlan(entitlements: Entitlements) {
  if (!entitlements.active) {
    throw new EntitlementError(
      "no_plan",
      entitlements.reason === "trial_ended"
        ? "Your trial has ended. Choose a plan to keep generating and publishing."
        : "Choose a plan to start generating and publishing.",
    );
  }
}

export function assertFeature(entitlements: Entitlements, feature: keyof Entitlements["features"], label: string) {
  assertActivePlan(entitlements);
  if (!entitlements.features[feature]) {
    throw new EntitlementError("feature_unavailable", `${label} is available on Pro and Max.`, featureUpgrade(entitlements, label));
  }
}

/**
 * Reserve usage against the plan limit atomically in Postgres. Returns a
 * release() callback to refund the reservation if the metered call fails.
 */
export async function consumeUsage(userId: string, entitlements: Entitlements, metric: UsageMetric, quantity = 1) {
  assertActivePlan(entitlements);
  const limit = entitlements.limits[METRIC_LIMIT_KEY[metric]];
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_quantity: quantity,
    p_limit: limit,
    p_since: entitlements.usagePeriodStart.toISOString(),
  });
  if (error) {
    log.error("usage reservation failed", { operation: "consume_usage", userId, metric }, error);
    throw new Error("Could not check your plan usage. Please try again.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) {
    throw new EntitlementError(
      "limit_reached",
      `You've used all ${limit} ${METRIC_LABEL[metric]} for this period. Upgrade for more, or wait for your next billing period.`,
      limitUpgrade(entitlements, metric),
    );
  }
  return {
    used: row.used as number,
    release: async () => {
      const { error: releaseError } = await admin
        .from("usage_events")
        .insert({ user_id: userId, metric, quantity: -quantity });
      if (releaseError) log.warn("usage release failed", { operation: "release_usage", userId, metric }, releaseError);
    },
  };
}

export async function getUsageSummary(userId: string, entitlements: Entitlements) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("usage_events")
    .select("metric,quantity")
    .eq("user_id", userId)
    .gte("created_at", entitlements.usagePeriodStart.toISOString());
  const totals: Record<UsageMetric, number> = { ai_generation: 0, ai_conversation: 0, ai_image: 0, x_credit: 0 };
  for (const row of data ?? []) {
    if (row.metric in totals) totals[row.metric as UsageMetric] += row.quantity;
  }
  return (Object.keys(totals) as UsageMetric[]).map((metric) => ({
    metric,
    label: METRIC_LABEL[metric],
    used: Math.max(0, totals[metric]),
    limit: entitlements.limits[METRIC_LIMIT_KEY[metric]],
  }));
}

/**
 * Before a plan exists, onboarding may write one first story (plus one retry)
 * so people see what Postory does before starting a trial. Counted against
 * the same usage log, over the account's whole life.
 */
export const PREVIEW_GENERATIONS = 2;

export async function previewGenerationsLeft(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("usage_events").select("quantity").eq("user_id", userId).eq("metric", "ai_generation");
  const used = (data ?? []).reduce((n, r) => n + r.quantity, 0);
  return Math.max(0, PREVIEW_GENERATIONS - used);
}

export async function consumePreviewGeneration(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_usage", {
    p_user_id: userId,
    p_metric: "ai_generation",
    p_quantity: 1,
    p_limit: PREVIEW_GENERATIONS,
    p_since: new Date(0).toISOString(),
  });
  if (error) {
    log.error("preview reservation failed", { operation: "consume_usage", userId, metric: "ai_generation" }, error);
    throw new Error("Could not check your usage. Please try again.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.allowed) throw new EntitlementError("no_plan", "You've seen what Postory can do — start your trial to keep writing.");
  return {
    release: async () => {
      const { error: releaseError } = await admin.from("usage_events").insert({ user_id: userId, metric: "ai_generation", quantity: -1 });
      if (releaseError) log.warn("usage release failed", { operation: "release_usage", userId, metric: "ai_generation" }, releaseError);
    },
  };
}
