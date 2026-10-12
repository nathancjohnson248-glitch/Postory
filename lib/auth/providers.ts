import "server-only";

import { env } from "@/lib/env";
import { privyGoogleEnabled } from "./privy";

/** google: how "Continue with Google" works, if it's offered at all. */
type AuthSettings = { google: "privy" | "supabase" | null; emailAutoconfirm: boolean; signupDisabled: boolean };

/**
 * Which sign-in methods the Supabase project actually has enabled, read from
 * its public settings endpoint, so the UI never offers a provider that would
 * fail. Cached for five minutes.
 */
export async function getAuthSettings(): Promise<AuthSettings> {
  const [supabase, privy] = await Promise.all([getSupabaseSettings(), privyGoogleEnabled()]);
  return { ...supabase, google: privy ? "privy" : supabase.google ? "supabase" : null };
}

async function getSupabaseSettings() {
  const url = env.supabaseUrl();
  const key = env.supabasePublishableKey();
  const fallback = { google: false, emailAutoconfirm: false, signupDisabled: false };
  if (!url || !key) return fallback;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { external?: Record<string, boolean>; mailer_autoconfirm?: boolean; disable_signup?: boolean };
    return { google: Boolean(data.external?.google), emailAutoconfirm: Boolean(data.mailer_autoconfirm), signupDisabled: Boolean(data.disable_signup) };
  } catch {
    return fallback;
  }
}
