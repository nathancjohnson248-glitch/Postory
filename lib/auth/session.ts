import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type SessionUser = { id: string; email: string | null };
export type Profile = Tables<"profiles">;

/**
 * Verifies the session JWT (signature + expiry) and returns the user.
 * Cached per request so layouts and pages share one verification.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email };
});

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** For /app/*: signed in AND onboarding complete. */
export async function requireOnboardedUser(): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  // A valid token without a profile means the account was removed; end the session.
  if (!profile) redirect("/auth/signout");
  if (!profile.onboarding_completed) redirect("/onboarding");
  return { user, profile };
}

/** For API routes and server actions: never redirects, returns null instead. */
export async function getAuthenticatedUserOrNull() {
  return getSessionUser();
}
