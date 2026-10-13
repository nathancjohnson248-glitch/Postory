import "server-only";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { env, integrations } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Postory's own sign-in codes. When an email sender is configured, Postory
 * issues a six-digit code, stores only an HMAC of it (an hour to live, five
 * tries), and emails it from Postory's address. A correct code opens a normal
 * Supabase session, minted server-side from a one-time token that never
 * leaves the server, so Supabase still owns the account and its session.
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
  // Cloudflare's header can't be set by the client; otherwise the right-most
  // forwarded address is the one our own edge added (the left-most is whatever
  // the client claimed).
  const ip = h.get("cf-connecting-ip")?.trim() || h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || h.get("x-real-ip")?.trim();
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

// --- Six-digit codes ----------------------------------------------------------------

export const CODE_LENGTH = 6;
const CODE_TTL_MS = 60 * 60 * 1000;
const MAX_CODE_TRIES = 5;
type CodePurpose = "verify" | "reset";

function codeHash(email: string, purpose: CodePurpose, code: string) {
  const secret = env.credentialsKey() ?? env.supabaseSecretKey() ?? "";
  return createHmac("sha256", secret).update(`${purpose}:${email.toLowerCase()}:${code}`).digest("hex");
}

/** A fresh code for this address and purpose; any earlier one stops working. */
async function issueCode(email: string, purpose: CodePurpose) {
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  const admin = createAdminClient();
  const emailHash = sha256(`email:${email.toLowerCase()}`);
  await admin.from("email_codes").delete().eq("email_hash", emailHash).eq("purpose", purpose);
  const { error } = await admin.from("email_codes").insert({
    email_hash: emailHash,
    purpose,
    code_hash: codeHash(email, purpose, code),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw error;
  return code;
}

export type CodeCheck = { ok: true; userId: string } | { ok: false; reason: "invalid" | "expired" | "too_many" | "no_account" };

/**
 * Check a code and, if it's right, open a session for the address. The code
 * is single-use; five wrong tries burn it.
 */
export async function verifyCodeAndSignIn(email: string, purpose: CodePurpose, code: string): Promise<CodeCheck> {
  const admin = createAdminClient();
  const emailHash = sha256(`email:${email.toLowerCase()}`);
  const { data: row } = await admin.from("email_codes").select("*").eq("email_hash", emailHash).eq("purpose", purpose).maybeSingle();
  if (!row) return { ok: false, reason: "invalid" };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_CODE_TRIES) return { ok: false, reason: "too_many" };

  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(codeHash(email, purpose, code), "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await admin.from("email_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return { ok: false, reason: row.attempts + 1 >= MAX_CODE_TRIES ? "too_many" : "invalid" };
  }
  // Single use: only the request that deletes the row gets to sign in.
  const { data: claimed } = await admin.from("email_codes").delete().eq("id", row.id).select("id");
  if (!claimed?.length) return { ok: false, reason: "invalid" };

  const account = await accountStatus(email);
  if (!account) return { ok: false, reason: "no_account" };
  if (!account.confirmed) {
    const { error } = await admin.auth.admin.updateUserById(account.userId, { email_confirm: true });
    if (error) throw error;
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) throw error ?? new Error("no token in generated link");
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) throw verifyError;
  await markEmailProven(account.userId);
  return { ok: true, userId: account.userId };
}

async function deliver(email: string, template: "signupCode" | "resetCode" | "loginCode", code: string): Promise<CodeOutcome> {
  const result = await sendEmail(email, template, { code });
  return result.sent ? { status: "sent", codeLength: code.length } : { status: "failed" };
}

export type EmailCodeOutcome =
  | { status: "sent"; codeLength: number; fresh: boolean }
  | { status: "throttled"; retryAfter: number }
  | { status: "failed" };

/**
 * Passwordless sign-in and sign-up: one code by email, either way.
 * - A confirmed account gets a login code.
 * - A new address gets a fresh, unconfirmed account and a confirmation code;
 *   entering the code confirms it.
 * - An unconfirmed leftover is started over first, so nothing set by whoever
 *   created it (a password, a name) survives the real owner confirming.
 * Codes are recovery-token OTPs, which `verifyOtp({ type: "email" })`
 * accepts for both cases.
 */
export async function sendEmailCode(email: string): Promise<EmailCodeOutcome> {
  try {
    const existing = await accountStatus(email);
    const claim = await claimSend(email, "signup");
    if (!claim.ok) return { status: "throttled", retryAfter: claim.retryAfter };

    const admin = createAdminClient();
    const fresh = !existing?.confirmed;
    if (existing && !existing.confirmed) {
      const { error } = await admin.auth.admin.deleteUser(existing.userId);
      if (error) throw error;
    }
    if (fresh) {
      const { error } = await admin.auth.admin.createUser({ email, email_confirm: false, app_metadata: { signup_method: "email_code" } });
      if (error && error.code !== "email_exists" && error.code !== "user_already_exists") throw error;
    }

    const code = await issueCode(email, "verify");
    const sent = await deliver(email, fresh ? "signupCode" : "loginCode", code);
    return sent.status === "sent" ? { status: "sent", codeLength: sent.codeLength, fresh } : { status: "failed" };
  } catch (error) {
    log.error("email code failed", { operation: "auth.codes.email", provider: "supabase" }, error);
    return { status: "failed" };
  }
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
    if (!data.user) throw new Error("Auth created no user");
    return await deliver(input.email, "signupCode", await issueCode(input.email, "verify"));
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

    return await deliver(email, "signupCode", await issueCode(email, "verify"));
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

    return await deliver(email, "resetCode", await issueCode(email, "reset"));
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

/**
 * Record that the account holder proved they own the address (an emailed code
 * or Google). Accounts without this mark may have been registered by someone
 * else in "instant" mode, so their password is rotated the first time the
 * real owner proves ownership (see signInWithVerifiedGoogle).
 */
export async function markEmailProven(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data.user || data.user.app_metadata?.email_proven === true) return;
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, email_proven: true } });
  if (error) log.warn("could not mark email proven", { operation: "auth.proven", userId }, error);
}

export type GoogleSignInOutcome = { status: "signed_in"; created: boolean } | { status: "failed" };

/**
 * Open a Supabase session for an address Google has verified (through Privy).
 * The account is keyed by email, so someone who signed up with a password
 * gets the same account — nothing is orphaned. A new address gets a new,
 * already-confirmed account. The session is minted with a one-time magic-link
 * token that never leaves the server.
 */
export async function signInWithVerifiedGoogle(input: { email: string; name: string | null }): Promise<GoogleSignInOutcome> {
  try {
    const admin = createAdminClient();
    const existing = await accountStatus(input.email);
    let created = false;
    if (!existing) {
      const { error } = await admin.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: input.name ? { full_name: input.name } : {},
        app_metadata: { signup_method: "google", email_proven: true },
      });
      // A concurrent sign-in may have created it a moment ago.
      if (error && error.code !== "email_exists" && error.code !== "user_already_exists") throw error;
      created = !error;
    } else {
      // Google just proved ownership of the address. If nobody had proved it
      // before (an unconfirmed sign-up, or one made while email codes were
      // off), whoever registered it may not be this person: replace the
      // password they chose so it can't be used to get back in.
      const { data: found } = await admin.auth.admin.getUserById(existing.userId);
      const proven = found.user?.app_metadata?.email_proven === true;
      if (!existing.confirmed || !proven) {
        const { error } = await admin.auth.admin.updateUserById(existing.userId, {
          email_confirm: true,
          password: randomBytes(32).toString("base64url"),
          app_metadata: { ...(found.user?.app_metadata ?? {}), email_proven: true },
        });
        if (error) throw error;
        log.info("unproven account claimed by google sign-in; password rotated", { operation: "auth.google.claim", userId: existing.userId });
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: input.email });
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) throw error ?? new Error("no token in generated link");

    const supabase = await createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (verifyError) throw verifyError;
    return { status: "signed_in", created };
  } catch (error) {
    log.error("google sign-in failed", { operation: "auth.google.session", provider: "supabase" }, error);
    return { status: "failed" };
  }
}
