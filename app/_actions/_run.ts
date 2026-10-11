import "server-only";

import { unstable_rethrow } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { BillingUnavailableError } from "@/lib/billing/handypay";
import { ConfigurationError } from "@/lib/env";
import { EntitlementError } from "@/lib/entitlements";
import { GenerationError } from "@/lib/ai/generate-posts";
import { fail, ok, UserFacingError, type ActionResult } from "@/lib/errors";
import { log } from "@/lib/log";
import { InvalidTransitionError } from "@/lib/posts/state-machine";

export function toFailure(error: unknown, operation: string, userId?: string): ReturnType<typeof fail> {
  if (error instanceof UserFacingError) return fail(error.code, error.message, error.action);
  if (error instanceof EntitlementError) {
    return fail(error.code, error.message, { label: error.code === "no_plan" ? "Choose a plan" : "See plans", href: "/app/billing" });
  }
  if (error instanceof InvalidTransitionError) return fail("invalid_state", error.message);
  if (error instanceof BillingUnavailableError) return fail(`billing_${error.code}`, error.message);
  if (error instanceof GenerationError) {
    log.warn("ai generation error", { operation, userId, provider: "openai", code: error.code }, error);
    return fail(
      `ai_${error.code}`,
      error.code === "provider_error" ? "Postory's writer is unavailable right now. Nothing was used from your plan. Try again shortly." : error.message,
    );
  }
  if (error instanceof ConfigurationError) {
    log.warn("feature not configured", { operation, userId, variable: error.variable });
    return fail("not_configured", "This feature isn't configured on this Postory deployment yet.");
  }
  log.error("action failed", { operation, userId }, error);
  return fail("unexpected", "Something went wrong on our side. Try again — if it keeps happening, contact support.");
}

/** Authenticate, run, and translate errors for a server action. */
export async function runAction<T>(operation: string, fn: (user: SessionUser) => Promise<T>): Promise<ActionResult<T>> {
  const user = await getSessionUser();
  if (!user) return fail("unauthenticated", "Your session has ended. Log in again.", { label: "Log in", href: "/login" });
  try {
    return ok(await fn(user));
  } catch (error) {
    unstable_rethrow(error);
    return toFailure(error, operation, user.id);
  }
}
