import "server-only";

import { redirect } from "next/navigation";
import { billingAvailability } from "@/lib/billing/service";
import { getEntitlements } from "@/lib/entitlements";
import { getAdminRole } from "./admin";
import { requireOnboardedUser } from "./session";

/**
 * The gate for everything under /app: signed in, onboarded, and on a trial
 * or paid plan. People without one go to /start to begin their trial.
 * Postory staff (owner and admins) are never gated.
 *
 * Called from the layout (first load) and from every page (client-side
 * navigations don't re-run layouts), and cached per request.
 */
export async function requireAppAccess() {
  const { user, profile } = await requireOnboardedUser();
  const [entitlements, adminRole] = await Promise.all([getEntitlements(user.id), getAdminRole(user)]);
  // If billing itself isn't configured nobody could start a trial; features
  // still check the plan individually, so this only keeps the app reachable.
  if (!entitlements.active && !adminRole && billingAvailability().checkout) redirect("/start");
  return { user, profile, entitlements, adminRole };
}
