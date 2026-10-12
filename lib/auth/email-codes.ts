import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { env, integrations } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Postory's own sign-in codes. When an email sender is configured (an SMTP
 * mailbox such as Zoho Mail, or Resend), Postory asks the
 * Auth admin API for a one-time code (no email is sent by Supabase) and
 * delivers it from Postory's address. The code is verified with the regular
 * `verifyOtp` call, so Supabase still owns the account and its session.
 *
 * Emails only ever contain a code — never a link.
 */

export type CodeOutcome =
  | { status: "sent"; codeLength: number }
  | { status: "throttled"; retryAfter: number }
  | { status: "exists" }
  | { status: "confirmed" }
  | { status: "no_account" }
  | { status: "invalid"; message: string }
  | { status: "failed" };

export function postorySendsAuthEmail() {
  return integrations.email() && integrations.supabaseAdmin() && env.authEmailCodes();
}

/**
 * How sign-up and password reset reach people:
 * - "codes": Postory emails a one-time code from its own address.
 * - "instant": no sender is configured yet, so accounts are created already
 *   confirmed and Supabase never emails anyone. Codes switch on by
 *   themselves as soon as a sender is configured.
 * - "supabase": local development without a service key.
 */
export type AuthEmailMode = "codes" | "instant" | "supabase";

export function authEmailMode(): AuthEmailMode {
  if (postorySendsAuthEmail()) return "codes";
  if (integrations.supabaseAdmin()) return "instant";
  return "supabase";
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

async function originHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return ip ? sha256(`ip:${ip}`) : null;
}

async function accountStatus(email: string) {
  const { data, error } = await createAdminClient().rpc("auth_email_status", { p_email: email });
  if (error) throw error;
  const row = data?.[0];
  return row ? { userId: row.user_id, confirmed: row.confirmed } : null;
}

/** Records the send if allowed: 1/min and 5/hour per address, 20/hour per origin. */
async function claimSend(email: string, purpose: "signup" | "recovery") {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_auth_email_send", {
    p_email_hash: sha256(`email:${email}`),
    p_ip_hash: await originHash(),
    p_purpose: purpose,
  });
  if (error) throw error;
  // Keep the log short-lived; failures here never block a send.
  if (Math.random() < 0.05) {
    void admin
      .from("auth_email_sends")
      .delete()
      .lt("created_at", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
      .then(({ error: pruneError }) => {
        if (pruneError) log.warn("auth email log prune failed", { operation: "auth.codes.prune" }, pruneError);
      });
  }
  const row = data?.[0];
  return row?.allowed ? { ok: true as const } : { ok: false as const, retryAfter: row?.retry_after_seconds ?? 60 };
}

async function deliver(email: string, template: "signupCode" | "resetCode", code: string): Promise<CodeOutcome> {
  const result = await sendEmail(email, template, { code });
  return result.sent ? { status: "sent", codeLength: code.length } : { status: "failed" };
}

/**
 * New account: create it unconfirmed and email the confirmation code.
 * An earlier sign-up for the same address that was never confirmed is started
 * over, so a password chosen by whoever got there first can't survive the
 * real owner confirming the address.
 */
export async function startSignupWithCode(input: { email: string; password: string; name: string }): Promise<CodeOutcome> {
  try {
    const existing = await accountStatus(input.email);
    if (existing?.confirmed) return { status: "exists" };

    const claim = await claimSend(input.email, "signup");
    if (!claim.ok) return { status: "throttled", retryAfter: claim.retryAfter };

    const admin = createAdminClient();
    if (existing) {
      const { error } = await admin.auth.admin.deleteUser(existing.userId);
      if (error) throw error;
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.name } },
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") return { status: "exists" };
      if (error.code === "weak_password" || error.code === "validation_failed") return { status: "invalid", message: error.message };
      throw error;
    }
    const code = data.properties?.email_otp;
    if (!code) throw new Error("Auth returned no code");
    return await deliver(input.email, "signupCode", code);
  } catch (error) {
    log.error("signup code failed", { operation: "auth.codes.signup", provider: "supabase" }, error);
    return { status: "failed" };
  }
}

/**
 * Another confirmation code for an account that exists but isn't confirmed
 * (resend, or a log-in attempt before confirming). Uses a recovery token,
 * which `verifyOtp({ type: "email" })` accepts and which confirms the address
 * on success — and which never creates an account as a side effect.
 */
export async function resendSignupCode(email: string): Promise<CodeOutcome> {
  try {
    const existing = await accountStatus(email);
    if (!existing) return { status: "no_account" };
    if (existing.confirmed) return { status: "confirmed" };

    const claim = await claimSend(email, "signup");
    if (!claim.ok) return { status: "throttled", retryAfter: claim.retryAfter };

    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
    if (error) throw error;
    const code = data.properties?.email_otp;
    if (!code) throw new Error("Auth returned no code");
    return await deliver(email, "signupCode", code);
  } catch (error) {
    log.error("signup code resend failed", { operation: "auth.codes.resend", provider: "supabase" }, error);
    return { status: "failed" };
  }
}

/** Password reset code. Unknown addresses get no email, and the caller answers the same either way. */
export async function sendPasswordResetCode(email: string): Promise<CodeOutcome> {
  try {
    const existing = await accountStatus(email);
    if (!existing) return { status: "no_account" };

    const claim = await claimSend(email, "recovery");
    if (!claim.ok) return { status: "throttled", retryAfter: claim.retryAfter };

    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
    if (error) throw error;
    const code = data.properties?.email_otp;
    if (!code) throw new Error("Auth returned no code");
    return await deliver(email, "resetCode", code);
  } catch (error) {
    log.error("reset code failed", { operation: "auth.codes.reset", provider: "supabase" }, error);
    return { status: "failed" };
  }
}

export type CreateOutcome =
  | { status: "created" }
  | { status: "exists" }
  | { status: "throttled"; retryAfter: number }
  | { status: "invalid"; message: string }
  | { status: "failed" };

/** "instant" mode: create the account confirmed, with no email sent by anyone. */
export async function createConfirmedAccount(input: { email: string; password: string; name: string }): Promise<CreateOutcome> {
  try {
    const existing = await accountStatus(input.email);
    if (existing?.confirmed) return { status: "exists" };

    // Same per-address and per-origin limits as code emails, against bulk sign-ups.
    const claim = await claimSend(input.email, "signup");
    if (!claim.ok) return { status: "throttled", retryAfter: claim.retryAfter };

    const admin = createAdminClient();
    if (existing) {
      const { error } = await admin.auth.admin.deleteUser(existing.userId);
      if (error) throw error;
    }
    const { error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.name },
    });
    if (error) {
      if (error.code === "email_exists" || error.code === "user_already_exists") return { status: "exists" };
      if (error.code === "weak_password" || error.code === "validation_failed") return { status: "invalid", message: error.message };
      throw error;
    }
    return { status: "created" };
  } catch (error) {
    log.error("account creation failed", { operation: "auth.instant.create", provider: "supabase" }, error);
    return { status: "failed" };
  }
}

/**
 * "instant" mode: an account left unconfirmed by an earlier sign-up. Only
 * called after Auth has accepted the password for it.
 */
export async function confirmWithoutEmail(email: string): Promise<boolean> {
  try {
    const existing = await accountStatus(email);
    if (!existing) return false;
    if (existing.confirmed) return true;
    const { error } = await createAdminClient().auth.admin.updateUserById(existing.userId, { email_confirm: true });
    if (error) throw error;
    return true;
  } catch (error) {
    log.error("confirm without email failed", { operation: "auth.instant.confirm", provider: "supabase" }, error);
    return false;
  }
}
