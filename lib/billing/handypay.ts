import "server-only";

/**
 * HandyPay adapter — https://tryhandypay.com (API: https://api.handypay.me/api)
 *
 * Mapped from HandyPay's own published API client (the open-source
 * "HandyPay Payments" WordPress plugin, class-handypay-api-client.php) and
 * verified against the live API with read-only calls:
 *
 *   Auth      Authorization: Bearer <HANDYPAY_API_KEY>
 *   Envelope  { success: boolean, data?: T, error?: { code, message } }
 *   Writes    Idempotency-Key header on every POST
 *
 *   POST /v1/subscription-sessions            hosted checkout in subscription mode
 *   GET  /v1/payment-sessions/{id}            checkout outcome (+ subscription id)
 *   GET  /v1/subscriptions/{id}               subscription state (Stripe-shaped)
 *   POST /v1/subscriptions/{id}/cancel        { at_period_end }
 *   POST /v1/subscriptions/{id}/resume        undo a scheduled cancellation
 *   POST /v1/subscriptions/{id}/portal-session { return_url } -> { url }
 *
 * HandyPay runs on Stripe, so subscription objects follow Stripe's shape
 * (unix-second timestamps, `items.data[].price`). No webhooks are used:
 * Postory reads state back on checkout return and whenever it goes stale.
 */

import { env, integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { PLANS, isPlanId, type PlanId } from "./plans";

export type ProviderSubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "expired" | "incomplete";

export type ProviderSubscription = {
  reference: string;
  customerReference: string | null;
  plan: PlanId | null;
  status: ProviderSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

export type CheckoutInput = {
  plan: PlanId;
  trialDays: number;
  customerEmail: string | null;
  /** Reuse the HandyPay customer from an earlier subscription. */
  customerReference: string | null;
  /** Postory's billing_events id, echoed in metadata. */
  clientReference: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { url: string; reference: string };

export type CheckoutOutcome =
  | { state: "complete"; subscriptionReference: string; customerReference: string | null }
  | { state: "open" }
  | { state: "expired" };

export class BillingUnavailableError extends Error {
  constructor(
    public readonly code: "not_configured" | "provider_error" | "account_suspended",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "BillingUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type Envelope<T> = { success?: boolean; data?: T; error?: { code?: string; message?: string } };

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const key = env.handypayApiKey();
  if (!key) throw new BillingUnavailableError("not_configured", "Billing isn't configured on this deployment yet.");

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method === "POST") headers["Idempotency-Key"] = idempotencyKey ?? crypto.randomUUID();

  let response: Response;
  try {
    response = await fetch(`${env.handypayBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    log.warn("handypay request failed", { operation: `${method} ${path}`, provider: "handypay" }, error);
    throw new BillingUnavailableError("provider_error", "Couldn't reach HandyPay. Try again in a moment.");
  }

  const text = await response.text();
  let payload: Envelope<T> | T | null = null;
  try {
    payload = text ? (JSON.parse(text) as Envelope<T>) : null;
  } catch {
    payload = null;
  }

  const envelope = payload && typeof payload === "object" && "success" in (payload as object) ? (payload as Envelope<T>) : null;
  const errorCode = envelope?.error?.code ?? "";

  if (response.status === 403 && errorCode === "account_suspended") {
    log.error("handypay account suspended", { operation: `${method} ${path}`, provider: "handypay" });
    throw new BillingUnavailableError("account_suspended", "Billing is temporarily unavailable. Please try again later.", 403);
  }
  if (envelope) {
    if (envelope.success) return (envelope.data ?? (envelope as unknown)) as T;
    log.warn("handypay error response", { operation: `${method} ${path}`, provider: "handypay", status: response.status, code: errorCode });
    throw new BillingUnavailableError("provider_error", envelope.error?.message || "HandyPay couldn't complete that request.", response.status);
  }
  if (response.ok) return (payload ?? {}) as T;
  log.warn("handypay http error", { operation: `${method} ${path}`, provider: "handypay", status: response.status });
  throw new BillingUnavailableError("provider_error", `HandyPay returned HTTP ${response.status}.`, response.status);
}

// ---------------------------------------------------------------------------
// Mapping (pure; unit-tested)
// ---------------------------------------------------------------------------

type RawSubscription = {
  id?: string;
  status?: string;
  customer?: string | { id?: string } | null;
  trial_end?: number | string | null;
  current_period_start?: number | string | null;
  current_period_end?: number | string | null;
  cancel_at_period_end?: boolean | null;
  cancel_at?: number | string | null;
  canceled_at?: number | string | null;
  metadata?: Record<string, unknown> | null;
  items?: {
    data?: {
      current_period_start?: number;
      current_period_end?: number;
      quantity?: number | null;
      price?: { unit_amount?: number | null; recurring?: { interval?: string | null; interval_count?: number | null } | null } | null;
      plan?: { amount?: number | null; interval?: string | null; interval_count?: number | null } | null;
    }[];
  } | null;
  plan?: { amount?: number | null; interval?: string | null; interval_count?: number | null } | null;
  amount_cents?: number | null;
  quantity?: number | null;
  created?: number | string | null;
  start_date?: number | string | null;
  ended_at?: number | string | null;
};

export function toDate(value: number | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapStatus(status: string | undefined): ProviderSubscriptionStatus {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
      return status;
    case "incomplete_expired":
    case "unpaid":
      return "expired";
    case "paused":
      return "incomplete";
    default:
      return "incomplete";
  }
}

/** Plan from our own metadata first, then from the recurring amount. */
export function planFromSubscription(raw: RawSubscription, fallback: PlanId | null = null): PlanId | null {
  const tagged = raw.metadata?.postory_plan;
  if (isPlanId(tagged)) return tagged;
  const cents = raw.items?.data?.[0]?.price?.unit_amount ?? raw.items?.data?.[0]?.plan?.amount ?? raw.plan?.amount ?? raw.amount_cents ?? null;
  if (typeof cents === "number") {
    const match = (Object.keys(PLANS) as PlanId[]).find((id) => PLANS[id].priceMonthlyUsd * 100 === cents);
    if (match) return match;
  }
  return fallback;
}

export function mapSubscription(raw: RawSubscription, fallbackPlan: PlanId | null = null): ProviderSubscription {
  if (!raw.id) throw new BillingUnavailableError("provider_error", "HandyPay returned a subscription without an id.");
  const item = raw.items?.data?.[0];
  const customer = typeof raw.customer === "string" ? raw.customer : raw.customer?.id ?? null;
  return {
    reference: raw.id,
    customerReference: customer,
    plan: planFromSubscription(raw, fallbackPlan),
    status: mapStatus(raw.status),
    trialEndsAt: toDate(raw.trial_end),
    // Newer Stripe API versions report the period on the subscription item.
    currentPeriodStart: toDate(raw.current_period_start ?? item?.current_period_start),
    currentPeriodEnd: toDate(raw.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: Boolean(raw.cancel_at_period_end) || Boolean(raw.cancel_at),
    canceledAt: toDate(raw.canceled_at),
  };
}

/** A subscription as the admin area reports it: amounts and lifecycle dates. */
export type AdminSubscription = ProviderSubscription & {
  rawStatus: string;
  userId: string | null;
  amountCents: number | null;
  monthlyCents: number | null;
  interval: string;
  intervalCount: number;
  createdAt: Date | null;
  endedAt: Date | null;
  taggedForPostory: boolean;
};

const MONTHS_PER: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };

export function mapAdminSubscription(raw: RawSubscription): AdminSubscription {
  const base = mapSubscription(raw);
  const item = raw.items?.data?.[0];
  const unit = item?.price?.unit_amount ?? item?.plan?.amount ?? raw.plan?.amount ?? raw.amount_cents ?? null;
  const quantity = item?.quantity ?? raw.quantity ?? 1;
  const interval = item?.price?.recurring?.interval ?? item?.plan?.interval ?? raw.plan?.interval ?? "month";
  const intervalCount = Math.max(1, item?.price?.recurring?.interval_count ?? item?.plan?.interval_count ?? raw.plan?.interval_count ?? 1);
  const amountCents = typeof unit === "number" ? unit * (quantity ?? 1) : null;
  const monthsPerInterval = (MONTHS_PER[interval] ?? 1) * intervalCount;
  const userId = typeof raw.metadata?.postory_user_id === "string" ? raw.metadata.postory_user_id : null;
  return {
    ...base,
    rawStatus: raw.status ?? "unknown",
    userId,
    amountCents,
    monthlyCents: amountCents === null ? null : Math.round(amountCents / monthsPerInterval),
    interval,
    intervalCount,
    createdAt: toDate(raw.start_date ?? raw.created),
    endedAt: toDate(raw.ended_at),
    taggedForPostory: Object.keys(raw.metadata ?? {}).some((k) => k.startsWith("postory_")),
  };
}

type RawSession = {
  id?: string;
  session_id?: string;
  url?: string;
  checkout_url?: string;
  status?: string;
  payment_status?: string;
  subscription?: string | { id?: string } | null;
  customer?: string | { id?: string } | null;
};

export function mapCheckoutOutcome(raw: RawSession): CheckoutOutcome {
  const status = raw.status ?? "";
  if (status === "expired") return { state: "expired" };
  const complete = ["complete", "completed", "paid", "succeeded"].includes(status);
  // Delayed payment methods can complete without paying; only count settled or trial sessions.
  if (!complete || raw.payment_status === "unpaid") return { state: "open" };
  const subscription = typeof raw.subscription === "string" ? raw.subscription : raw.subscription?.id;
  if (!subscription) return { state: "open" };
  const customer = typeof raw.customer === "string" ? raw.customer : raw.customer?.id ?? null;
  return { state: "complete", subscriptionReference: subscription, customerReference: customer };
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

async function createCheckout(input: CheckoutInput): Promise<CheckoutSession> {
  const plan = PLANS[input.plan];
  const body: Record<string, unknown> = {
    amount_cents: plan.priceMonthlyUsd * 100,
    currency: "USD",
    interval: "month",
    interval_count: 1,
    name: `Postory ${plan.name}`,
    quantity: 1,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { postory_user_id: input.userId, postory_event_id: input.clientReference, postory_plan: input.plan },
  };
  if (input.customerReference) body.customer_id = input.customerReference;
  else if (input.customerEmail) body.customer_email = input.customerEmail;
  if (input.trialDays > 0) body.trial_period_days = input.trialDays;

  // Keyed on our checkout record so a double submit returns the same session.
  const res = await request<RawSession>("POST", "/v1/subscription-sessions", body, `postory-checkout-${input.clientReference}`);
  const reference = res.session_id ?? res.id;
  const url = res.url ?? res.checkout_url;
  if (!reference || !url) throw new BillingUnavailableError("provider_error", "HandyPay didn't return a checkout link.");
  return { reference, url };
}

async function getCheckoutOutcome(sessionReference: string): Promise<CheckoutOutcome> {
  return mapCheckoutOutcome(await request<RawSession>("GET", `/v1/payment-sessions/${encodeURIComponent(sessionReference)}`));
}

async function getSubscription(reference: string, fallbackPlan: PlanId | null = null): Promise<ProviderSubscription> {
  return mapSubscription(await request<RawSubscription>("GET", `/v1/subscriptions/${encodeURIComponent(reference)}`), fallbackPlan);
}

async function cancelSubscription(reference: string, options: { atPeriodEnd: boolean }) {
  await request("POST", `/v1/subscriptions/${encodeURIComponent(reference)}/cancel`, { at_period_end: options.atPeriodEnd });
}

async function resumeSubscription(reference: string) {
  await request("POST", `/v1/subscriptions/${encodeURIComponent(reference)}/resume`, {});
}

/**
 * Every subscription on the HandyPay account (GET /v1/subscriptions, the
 * documented list endpoint), newest first. Bounded so a large account can't
 * stall a page.
 */
async function listSubscriptions(options: { maxPages?: number } = {}): Promise<{ subscriptions: AdminSubscription[]; truncated: boolean }> {
  const out: AdminSubscription[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < (options.maxPages ?? 10); page++) {
    const query = new URLSearchParams({ status: "all", limit: "100" });
    if (startingAfter) query.set("starting_after", startingAfter);
    const res = await request<{ data?: RawSubscription[]; has_more?: boolean } | RawSubscription[]>("GET", `/v1/subscriptions?${query}`);
    const rows = Array.isArray(res) ? res : (res.data ?? []);
    for (const row of rows) if (row.id) out.push(mapAdminSubscription(row));
    const more = !Array.isArray(res) && Boolean(res.has_more);
    if (!more || !rows.length) return { subscriptions: out, truncated: false };
    startingAfter = rows[rows.length - 1]?.id;
  }
  return { subscriptions: out, truncated: true };
}

async function createPortalSession(reference: string, returnUrl: string) {
  const res = await request<{ url?: string }>("POST", `/v1/subscriptions/${encodeURIComponent(reference)}/portal-session`, { return_url: returnUrl });
  if (!res.url) throw new BillingUnavailableError("provider_error", "HandyPay didn't return a management link.");
  return res.url;
}

export const handypay = {
  isConfigured: () => integrations.handypay(),
  createCheckout,
  getCheckoutOutcome,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  createPortalSession,
  listSubscriptions,
};
