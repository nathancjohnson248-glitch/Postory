import "server-only";

/**
 * HandyPay adapter — https://tryhandypay.com
 *
 * What is established (from HandyPay's own published integration notes):
 *   - API host: https://api.handypay.me (override with HANDYPAY_API_BASE_URL)
 *   - Requests authenticate with the account's API key (HANDYPAY_API_KEY)
 *   - Payment pages are hosted by HandyPay; card data never touches Postory
 *
 * What is NOT yet wired: the exact HandyPay endpoints and payloads for
 * subscription checkout, retrieval, plan changes and cancellation. HandyPay's
 * API reference wasn't reachable from the environment Postory was built in,
 * and Postory never guesses payment endpoints. Each operation below has its
 * Postory-side contract defined; until it is implemented against HandyPay's
 * documented API it reports `operation_not_mapped`, and the UI says billing
 * isn't available rather than faking a checkout.
 *
 * Wiring HandyPay = implementing the functions in `operations` below.
 * Nothing else in Postory needs to change. No webhooks are used: state is
 * read back from the API when the browser returns from checkout and when the
 * billing page loads.
 */

import { env, integrations } from "@/lib/env";
import type { PlanId } from "./plans";

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
  priceMonthlyUsd: number;
  trialDays: number;
  customerEmail: string | null;
  /** Postory's billing_events id — echoed back so the return can be reconciled. */
  clientReference: string;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { url: string; reference: string };

type Operations = {
  /** Create a hosted subscription checkout and return its URL + HandyPay reference. */
  createCheckout?: (input: CheckoutInput) => Promise<CheckoutSession>;
  /** Look up what a completed checkout produced. null = not completed (yet). */
  getCheckoutResult?: (checkoutReference: string) => Promise<ProviderSubscription | null>;
  getSubscription?: (subscriptionReference: string) => Promise<ProviderSubscription>;
  changePlan?: (subscriptionReference: string, plan: PlanId) => Promise<ProviderSubscription>;
  cancelSubscription?: (subscriptionReference: string) => Promise<ProviderSubscription>;
  /** HandyPay-hosted page where the customer manages payment details, if offered. */
  getManagementUrl?: (subscriptionReference: string) => Promise<string | null>;
};

/**
 * Implementations go here once mapped to HandyPay's documented API, using
 * `handypayRequest` below for transport.
 */
const operations: Operations = {};

export type BillingOperation = keyof Operations;

export class BillingUnavailableError extends Error {
  constructor(
    public readonly code: "not_configured" | "operation_not_mapped" | "provider_error",
    message: string,
  ) {
    super(message);
    this.name = "BillingUnavailableError";
  }
}

/**
 * Shared HTTP transport for HandyPay calls. Server-only; the key never leaves
 * the server. `authHeaders` receives the API key and returns the header(s)
 * HandyPay's reference specifies — supplied by the operation implementation
 * so the auth scheme is written down exactly once, from the docs.
 */
export async function handypayRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; authHeaders: (apiKey: string) => Record<string, string> },
): Promise<T> {
  const key = env.handypayApiKey();
  if (!key) throw new BillingUnavailableError("not_configured", "HandyPay isn't configured.");
  const response = await fetch(`${env.handypayBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...init.authHeaders(key),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : (null as T);
  if (!response.ok) throw new BillingUnavailableError("provider_error", `HandyPay returned HTTP ${response.status}.`);
  return payload;
}

function require<K extends BillingOperation>(op: K): NonNullable<Operations[K]> {
  if (!integrations.handypay()) {
    throw new BillingUnavailableError("not_configured", "Billing isn't configured on this deployment yet.");
  }
  const fn = operations[op];
  if (!fn) {
    throw new BillingUnavailableError("operation_not_mapped", "Billing isn't available yet. Postory's HandyPay connection is still being set up.");
  }
  return fn as NonNullable<Operations[K]>;
}

export const handypay = {
  isConfigured: () => integrations.handypay(),
  supports: (op: BillingOperation) => integrations.handypay() && Boolean(operations[op]),
  /** Can a customer actually start and complete a checkout right now? */
  canCheckout: () =>
    integrations.handypay() && Boolean(operations.createCheckout && operations.getCheckoutResult && operations.getSubscription),

  createCheckout: (input: CheckoutInput) => require("createCheckout")(input),
  getCheckoutResult: (reference: string) => require("getCheckoutResult")(reference),
  getSubscription: (reference: string) => require("getSubscription")(reference),
  changePlan: (reference: string, plan: PlanId) => require("changePlan")(reference, plan),
  cancelSubscription: (reference: string) => require("cancelSubscription")(reference),
  getManagementUrl: (reference: string) => require("getManagementUrl")(reference),
};
