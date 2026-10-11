"use server";

import { revalidatePath } from "next/cache";
import * as billing from "@/lib/billing/service";
import { getSubscriptionRow } from "@/lib/billing/service";
import { planSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

/** Start a HandyPay checkout — for a first subscription or a plan change. */
const RETURN_PATHS = ["/onboarding", "/start", "/app/billing"] as const;

export async function startPlanCheckout(plan: string, returnPath: (typeof RETURN_PATHS)[number]) {
  return runAction("billing.checkout", async (user) => {
    const parsed = planSchema.safeParse(plan);
    if (!parsed.success) throw new UserFacingError("invalid_plan", "Unknown plan.");
    const url = await billing.startCheckout(user, parsed.data, RETURN_PATHS.includes(returnPath) ? returnPath : "/app/billing");
    return { url };
  });
}

export async function cancelSubscriptionAction() {
  return runAction("billing.cancel", async (user) => {
    const sub = await billing.cancelSubscription(user.id);
    revalidatePath("/app", "layout");
    return { endsAt: sub.current_period_end };
  });
}

export async function resumeSubscriptionAction() {
  return runAction("billing.resume", async (user) => {
    await billing.resumeSubscription(user.id);
    revalidatePath("/app", "layout");
    return { resumed: true };
  });
}

export async function refreshSubscription() {
  return runAction("billing.sync", async (user) => {
    await billing.syncSubscription(user.id, { force: true });
    revalidatePath("/app", "layout");
    const row = await getSubscriptionRow(user.id);
    return { status: row?.status ?? null };
  });
}

export async function openBillingPortal() {
  return runAction("billing.portal", async (user) => {
    const url = await billing.getManagementUrl(user.id);
    if (!url) throw new UserFacingError("no_subscription", "There's no subscription to manage yet.");
    return { url };
  });
}
