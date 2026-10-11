"use server";

import { revalidatePath } from "next/cache";
import * as billing from "@/lib/billing/service";
import { PLANS } from "@/lib/billing/plans";
import { getSubscriptionRow } from "@/lib/billing/service";
import { planSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

export async function startPlanCheckout(plan: string, returnPath: "/onboarding" | "/app/billing") {
  return runAction("billing.checkout", async (user) => {
    const parsed = planSchema.safeParse(plan);
    if (!parsed.success) throw new UserFacingError("invalid_plan", "Unknown plan.");
    const url = await billing.startCheckout(user, parsed.data, returnPath === "/onboarding" ? "/onboarding" : "/app/billing");
    return { url };
  });
}

export async function changeSubscriptionPlan(plan: string) {
  return runAction("billing.changePlan", async (user) => {
    const parsed = planSchema.safeParse(plan);
    if (!parsed.success) throw new UserFacingError("invalid_plan", "Unknown plan.");
    const sub = await billing.changePlan(user.id, parsed.data);
    revalidatePath("/app", "layout");
    return { plan: sub.plan ? PLANS[sub.plan as keyof typeof PLANS]?.name ?? sub.plan : null };
  });
}

export async function cancelSubscriptionAction() {
  return runAction("billing.cancel", async (user) => {
    const sub = await billing.cancelSubscription(user.id);
    revalidatePath("/app", "layout");
    return { endsAt: sub.current_period_end };
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
    if (!url) throw new UserFacingError("no_portal", "HandyPay doesn't offer a self-serve page for this subscription.");
    return { url };
  });
}
