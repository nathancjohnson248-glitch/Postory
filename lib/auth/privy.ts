import "server-only";

import { PrivyClient } from "@privy-io/node";
import { env, integrations } from "@/lib/env";
import { log } from "@/lib/log";

/**
 * Google sign-in runs through Privy (https://docs.privy.io): Privy handles the
 * Google OAuth round trip in the browser, and the server verifies the Privy
 * access token and reads the user's linked Google account with the app
 * secret. Supabase stays the session and data owner — Privy only proves which
 * Google address the person controls. No wallets are ever created.
 */

let client: PrivyClient | null = null;

function privy() {
  client ??= new PrivyClient({ appId: env.privyAppId()!, appSecret: env.privyAppSecret()! });
  return client;
}

/** Whether Google is switched on for the Privy app (cached for five minutes). Fails open. */
export async function privyGoogleEnabled(): Promise<boolean> {
  const appId = env.privyAppId();
  if (!integrations.privy() || !appId) return false;
  try {
    // The same public app config the Privy SDK reads in the browser.
    const res = await fetch(`https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}`, {
      headers: { "privy-app-id": appId },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return true;
    const data = (await res.json()) as { google_oauth?: boolean };
    return data.google_oauth !== false;
  } catch {
    return true;
  }
}

export type GoogleIdentity = { email: string; name: string | null; privyUserId: string };

/**
 * Verify a Privy access token and return the Google account behind it, or
 * null if the token is invalid or the login didn't come from Google.
 */
export async function verifyGoogleLogin(accessToken: string): Promise<GoogleIdentity | null> {
  if (!integrations.privy()) return null;
  try {
    const claims = await privy().utils().auth().verifyAccessToken(accessToken);
    const user = await privy().users()._get(claims.user_id);
    const google = user.linked_accounts.find((a) => a.type === "google_oauth");
    if (!google || google.type !== "google_oauth" || !google.email) return null;
    return { email: google.email.trim().toLowerCase(), name: google.name?.trim() || null, privyUserId: user.id };
  } catch (error) {
    log.warn("privy google verification failed", { operation: "auth.google.verify", provider: "privy" }, error);
    return null;
  }
}
