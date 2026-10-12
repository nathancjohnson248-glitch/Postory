import "server-only";

import { env } from "@/lib/env";

/**
 * Zoho Mail's HTTPS API. Used instead of SMTP because Railway blocks
 * outbound SMTP below its Pro plan. Auth is a long-lived OAuth refresh
 * token (scopes ZohoMail.messages.CREATE, ZohoMail.accounts.READ) traded
 * for hour-long access tokens.
 */

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(force = false) {
  if (!force && cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const body = new URLSearchParams({
    refresh_token: env.zohoRefreshToken()!,
    client_id: env.zohoClientId()!,
    client_secret: env.zohoClientSecret()!,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${env.zohoAccountsUrl()}/oauth/v2/token`, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`Zoho token refresh failed: ${data.error ?? res.status}`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export async function sendViaZoho(message: { to: string; subject: string; html: string }) {
  const send = async (token: string) =>
    fetch(`${env.zohoMailUrl()}/api/accounts/${encodeURIComponent(env.zohoAccountId()!)}/messages`, {
      method: "POST",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fromAddress: env.zohoFrom(), toAddress: message.to, subject: message.subject, content: message.html, mailFormat: "html" }),
      signal: AbortSignal.timeout(15_000),
    });
  let res = await send(await accessToken());
  // A revoked or expired access token: refresh once and retry.
  if (res.status === 401) res = await send(await accessToken(true));
  const data = (await res.json().catch(() => ({}))) as { status?: { code?: number; description?: string }; data?: { messageId?: string } };
  if (!res.ok || data.status?.code !== 200) throw new Error(`Zoho send failed: ${data.status?.code ?? res.status} ${data.status?.description ?? ""}`.trim());
  return data.data?.messageId ?? null;
}
