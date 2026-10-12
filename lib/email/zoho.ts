import "server-only";

import { env } from "@/lib/env";

/**
 * Zoho Mail's HTTPS API. Used instead of SMTP because Railway blocks
 * outbound SMTP below its Pro plan. Auth is a long-lived OAuth refresh
 * token traded for hour-long access tokens. Sending needs
 * ZohoMail.messages.CREATE. The address is send-only: Postory never reads
 * the mailbox.
 */

export class ZohoScopeError extends Error {
  constructor() {
    super("The Zoho connection doesn't include mailbox access yet.");
    this.name = "ZohoScopeError";
  }
}

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

type ZohoEnvelope<T> = { status?: { code?: number; description?: string }; data?: T };

/** A call against the account's mailbox; refreshes the token once on a 401. */
async function zoho<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const url = `${env.zohoMailUrl()}/api/accounts/${encodeURIComponent(env.zohoAccountId()!)}${path}`;
  const call = async (token: string) =>
    fetch(url, {
      method: init.method ?? "GET",
      headers: { Authorization: `Zoho-oauthtoken ${token}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  let res = await call(await accessToken());
  if (res.status === 401) res = await call(await accessToken(true));
  const data = (await res.json().catch(() => ({}))) as ZohoEnvelope<T> & { data?: { errorCode?: string } };
  const errorCode = (data.data as { errorCode?: string } | undefined)?.errorCode ?? "";
  if (res.status === 401 || res.status === 403 || /SCOPE/i.test(errorCode)) throw new ZohoScopeError();
  if (!res.ok || data.status?.code !== 200) throw new Error(`Zoho ${init.method ?? "GET"} ${path.split("?")[0]} failed: ${data.status?.code ?? res.status} ${data.status?.description ?? ""}`.trim());
  return data.data as T;
}

export async function sendViaZoho(message: { to: string; subject: string; html: string; cc?: string }) {
  const data = await zoho<{ messageId?: string }>("/messages", {
    method: "POST",
    body: {
      fromAddress: env.zohoFrom(),
      toAddress: message.to,
      ...(message.cc ? { ccAddress: message.cc } : {}),
      subject: message.subject,
      content: message.html,
      mailFormat: "html",
    },
  });
  return data?.messageId ?? null;
}
