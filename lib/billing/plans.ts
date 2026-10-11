/**
 * Single source of truth for Postory plans. Pricing, limits and feature flags
 * live here and nowhere else — UI, entitlements and billing all read this.
 * Safe to import on the client.
 */

export const PLAN_IDS = ["solo", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const TRIAL_DAYS = 3;

export type PlanLimits = {
  /** null = unlimited */
  socialAccounts: number | null;
  aiGenerations: number;
  aiConversations: number;
  aiImages: number;
  xCredits: number;
};

export type PlanFeatures = {
  approvalWorkflow: boolean;
  calendar: boolean;
  businessMemory: boolean;
  unifiedInbox: boolean;
  advancedAnalytics: boolean;
  advancedPlanning: boolean;
};

export type Plan = {
  id: PlanId;
  name: string;
  priceMonthlyUsd: number;
  tagline: string;
  limits: PlanLimits;
  features: PlanFeatures;
};

const CORE_FEATURES = { approvalWorkflow: true, calendar: true, businessMemory: true } as const;

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: "solo",
    name: "Solo",
    priceMonthlyUsd: 15,
    tagline: "For getting started.",
    limits: { socialAccounts: 3, aiGenerations: 40, aiConversations: 30, aiImages: 25, xCredits: 200 },
    features: { ...CORE_FEATURES, unifiedInbox: false, advancedAnalytics: false, advancedPlanning: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthlyUsd: 29,
    tagline: "For businesses building a consistent presence.",
    limits: { socialAccounts: 10, aiGenerations: 150, aiConversations: 100, aiImages: 100, xCredits: 750 },
    features: { ...CORE_FEATURES, unifiedInbox: true, advancedAnalytics: true, advancedPlanning: true },
  },
  max: {
    id: "max",
    name: "Max",
    priceMonthlyUsd: 59,
    tagline: "For businesses running social seriously.",
    limits: { socialAccounts: null, aiGenerations: 500, aiConversations: 300, aiImages: 250, xCredits: 2000 },
    features: { ...CORE_FEATURES, unifiedInbox: true, advancedAnalytics: true, advancedPlanning: true },
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/** Bullet list shown on pricing cards — derived from the config, never hand-typed twice. */
export function planHighlights(plan: Plan): string[] {
  const l = plan.limits;
  const lines = [
    l.socialAccounts === null ? "Unlimited social accounts" : `${l.socialAccounts} social accounts`,
    `${l.aiGenerations} AI post generations / month`,
    `${l.aiConversations} AI conversations / month`,
    `${l.aiImages} AI images / month`,
    `${l.xCredits.toLocaleString("en-US")} X credits / month`,
    "Unlimited scheduled posts (fair use)",
    "Approval workflow",
    "Calendar",
    "Business memory",
  ];
  if (plan.features.unifiedInbox) lines.push("Unified inbox");
  if (plan.features.advancedAnalytics) lines.push("Advanced analytics");
  if (plan.features.advancedPlanning) lines.push("Advanced planning");
  return lines;
}

export const USAGE_METRICS = ["ai_generation", "ai_conversation", "ai_image", "x_credit"] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

export const METRIC_LIMIT_KEY: Record<UsageMetric, keyof Omit<PlanLimits, "socialAccounts">> = {
  ai_generation: "aiGenerations",
  ai_conversation: "aiConversations",
  ai_image: "aiImages",
  x_credit: "xCredits",
};

export const METRIC_LABEL: Record<UsageMetric, string> = {
  ai_generation: "AI post generations",
  ai_conversation: "AI conversations",
  ai_image: "AI images",
  x_credit: "X credits",
};

/** X credits consumed per post published or scheduled to X. */
export const X_CREDITS_PER_POST = 1;
