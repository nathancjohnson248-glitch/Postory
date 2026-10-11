"use server";

import { redirect } from "next/navigation";
import { authEmailMode, confirmWithoutEmail, createConfirmedAccount, resendSignupCode, sendPasswordResetCode, startSignupWithCode } from "@/lib/auth/email-codes";
import { requestOrigin } from "@/lib/auth/origin";
import { clearPendingEmail, getPendingEmail, setPendingEmail } from "@/lib/auth/pending";
import { log } from "@/lib/log";
import { site } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { SignInSchema, SignUpSchema, emailCodeSchema, emailSchema, firstError, passwordSchema, safeNextPath } from "@/lib/validation/schemas";

export type AuthFormState =
  | {
      error?: string;
      notice?: string;
      email?: string;
      /** Seconds until another code may be requested. */
      retryAfter?: number;
      /** Changes on every result so the code input can reset and shake. */
      attempt?: number;
    }
  | undefined;

const EXISTS = "An account with this email already exists. Log in instead.";
const SEND_FAILED = "We couldn't send the email just now. Try again in a minute.";

const BY_CODE: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Try again or reset your password.",
  otp_expired: "That code is wrong or has expired. Check the newest email, or send a new code.",
  over_email_send_rate_limit: "Too many emails went out just now, so we couldn't send yours. Try again in a few minutes.",
  email_address_invalid: "That address can't receive email. Use a different one.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  email_address_not_authorized: `We can't send email to that address yet. Write to ${site.founder.email} and we'll get you in.`,
  user_already_exists: EXISTS,
  email_exists: EXISTS,
  same_password: "That's your current password. Choose a new one.",
};

function friendlyAuthError(error: { code?: string; message: string }) {
  if (error.code && BY_CODE[error.code]) return BY_CODE[error.code];
  const m = error.message.toLowerCase();
  if (m.includes("invalid login credentials")) return BY_CODE.invalid_credentials;
  if (m.includes("token has expired") || m.includes("link is invalid")) return BY_CODE.otp_expired;
  if (m.includes("already registered") || m.includes("already been registered")) return EXISTS;
  if (m.includes("rate limit") || m.includes("too many")) return BY_CODE.over_request_rate_limit;
  if (m.includes("not authorized")) return BY_CODE.email_address_not_authorized;
  if (m.includes("password")) return error.message;
  return "Something went wrong. Try again.";
}

function waitMessage(seconds: number) {
  if (seconds >= 120) return "You've asked for a few codes already. Try again in an hour, or use the newest code you have.";
  return `A code was sent moments ago. You can ask for another in ${seconds}s.`;
}

const isUnconfirmed = (error: { code?: string; message: string }) =>
  error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed");

// ---------------------------------------------------------------------------
// Log in
// ---------------------------------------------------------------------------

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error), email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Auth only reports "not confirmed" after the password checks out, so
    // this can't be used to probe for accounts. Send a fresh code and go to
    // the code screen.
    if (isUnconfirmed(error)) {
      const mode = authEmailMode();
      if (mode === "instant") {
        // No email sender yet: the password checked out, so finish the
        // sign-up that an earlier confirmation email never completed.
        if (await confirmWithoutEmail(parsed.data.email)) {
          const retry = await supabase.auth.signInWithPassword(parsed.data);
          if (!retry.error) redirect(safeNextPath.parse(formData.get("next") ?? "/app"));
        }
        return { error: "Something went wrong signing you in. Try again.", email: parsed.data.email };
      }
      let codeLength: number | undefined;
      if (mode === "codes") {
        const outcome = await resendSignupCode(parsed.data.email);
        if (outcome.status === "sent") codeLength = outcome.codeLength;
      } else {
        const { error: resendError } = await supabase.auth.resend({ type: "signup", email: parsed.data.email });
        if (resendError) log.warn("confirmation resend failed", { operation: "auth.signIn.resend" }, resendError);
      }
      await setPendingEmail("verify", parsed.data.email, codeLength);
      redirect("/verify?reason=unconfirmed");
    }
    return { error: friendlyAuthError(error), email: parsed.data.email };
  }

  redirect(safeNextPath.parse(formData.get("next") ?? "/app"));
}

// ---------------------------------------------------------------------------
// Sign up → code → onboarding
// ---------------------------------------------------------------------------

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), email: String(formData.get("email") ?? "") };
  const { email } = parsed.data;

  const mode = authEmailMode();
  if (mode === "instant") {
    const outcome = await createConfirmedAccount(parsed.data);
    if (outcome.status === "exists") return { error: EXISTS, email };
    if (outcome.status === "invalid") return { error: outcome.message, email };
    if (outcome.status === "throttled") return { error: "Too many sign-ups from this network just now. Try again in a little while.", email };
    if (outcome.status === "failed") return { error: "We couldn't create your account. Try again in a minute.", email };
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error) return { error: friendlyAuthError(error), email };
    redirect("/onboarding");
  }

  let codeLength: number | undefined;
  if (mode === "codes") {
    const outcome = await startSignupWithCode(parsed.data);
    switch (outcome.status) {
      case "sent":
        codeLength = outcome.codeLength;
        break;
      case "throttled":
        // A code went out moments ago (a double submit); use that one.
        break;
      case "exists":
        return { error: EXISTS, email };
      case "invalid":
        return { error: outcome.message, email };
      default:
        return { error: SEND_FAILED, email };
    }
  } else {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        // Only used if the project's email template still contains a link.
        emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
        data: { full_name: parsed.data.name },
      },
    });
    if (error) {
      log.warn("sign up failed", { operation: "auth.signUp" }, error);
      return { error: friendlyAuthError(error), email };
    }
    // Email confirmation is switched off for the project: straight in.
    if (data.session) redirect("/onboarding");
    // Auth hides existing accounts behind a user with no identities.
    if (data.user && data.user.identities?.length === 0) return { error: EXISTS, email };
  }

  await setPendingEmail("verify", email, codeLength);
  redirect("/verify");
}

export async function verifySignupCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const pending = await getPendingEmail("verify");
  if (!pending) return { error: "This sign-up has timed out. Start again or log in.", attempt: Date.now() };
  const code = emailCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: firstError(code.error), attempt: Date.now() };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: code.data, type: "email" });
  if (error) return { error: friendlyAuthError(error), attempt: Date.now() };

  await clearPendingEmail("verify");
  redirect("/onboarding");
}

async function resendVerificationCodeInner(): Promise<AuthFormState> {
  const pending = await getPendingEmail("verify");
  if (!pending) return { error: "This sign-up has timed out. Start again or log in." };

  const mode = authEmailMode();
  if (mode === "instant") return { error: "No code is needed right now — log in with your email and password." };
  if (mode === "codes") {
    const outcome = await resendSignupCode(pending.email);
    switch (outcome.status) {
      case "sent":
        await setPendingEmail("verify", pending.email, outcome.codeLength);
        return { notice: `New code sent to ${pending.email}.`, retryAfter: 60 };
      case "throttled":
        return { error: waitMessage(outcome.retryAfter), retryAfter: Math.min(outcome.retryAfter, 3600) };
      case "confirmed":
        return { error: "This email is already confirmed. Log in to continue." };
      case "no_account":
        return { error: "There's no sign-up waiting for this email. Start again." };
      default:
        return { error: SEND_FAILED };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email: pending.email });
  if (error) return { error: friendlyAuthError(error), retryAfter: error.code === "over_email_send_rate_limit" ? 60 : undefined };
  return { notice: `New code sent to ${pending.email}.`, retryAfter: 60 };
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath.parse(formData.get("next") ?? "/app");
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    log.warn("google oauth start failed", { operation: "auth.google" }, error);
    redirect(`/login?error=oauth`);
  }
  redirect(data.url);
}

// ---------------------------------------------------------------------------
// Password reset: email → code + new password
// ---------------------------------------------------------------------------

const RESET_UNAVAILABLE = `Password reset by email is still being set up. Email ${site.founder.email} from your account's address and we'll reset it for you.`;

async function sendResetCode(email: string): Promise<{ codeLength?: number; error?: string; retryAfter?: number }> {
  const mode = authEmailMode();
  // Never fall back to Supabase's own mailer in production.
  if (mode === "instant") return { error: RESET_UNAVAILABLE };
  if (mode === "codes") {
    const outcome = await sendPasswordResetCode(email);
    if (outcome.status === "sent") return { codeLength: outcome.codeLength };
    if (outcome.status === "throttled") return { retryAfter: outcome.retryAfter };
    if (outcome.status === "failed") return { error: SEND_FAILED };
    // No account: answer exactly as if one existed.
    return {};
  }
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  if (error) {
    log.warn("password reset request failed", { operation: "auth.resetRequest" }, error);
    if (error.code === "over_email_send_rate_limit") return { retryAfter: 60 };
  }
  return {};
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const result = await sendResetCode(parsed.data);
  if (result.error) return { error: result.error, email: parsed.data };
  await setPendingEmail("reset", parsed.data, result.codeLength);
  redirect("/reset-password");
}

async function resendResetCodeInner(): Promise<AuthFormState> {
  const pending = await getPendingEmail("reset");
  if (!pending) return { error: "This reset has timed out. Start again." };
  const result = await sendResetCode(pending.email);
  if (result.error) return { error: result.error };
  if (result.retryAfter) return { error: waitMessage(result.retryAfter), retryAfter: Math.min(result.retryAfter, 3600) };
  if (result.codeLength) await setPendingEmail("reset", pending.email, result.codeLength);
  return { notice: `If ${pending.email} has a Postory account, a new code is on its way.`, retryAfter: 60 };
}

export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success) return { error: firstError(password.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();

  // Signed in already (an older reset link, or changing it from the app):
  // the session is the proof. Otherwise the emailed code is.
  if (!claims?.claims?.sub) {
    const pending = await getPendingEmail("reset");
    if (!pending) return { error: "This reset has timed out. Request a new code." };
    const code = emailCodeSchema.safeParse(formData.get("code"));
    if (!code.success) return { error: firstError(code.error), attempt: Date.now() };
    const { error } = await supabase.auth.verifyOtp({ email: pending.email, token: code.data, type: "recovery" });
    if (error) return { error: friendlyAuthError(error), attempt: Date.now() };
  }

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: friendlyAuthError(error) };
  await clearPendingEmail("reset");
  redirect("/app");
}

// Every resend result is distinct so the countdown restarts even when the
// message repeats.
export async function resendVerificationCode(): Promise<AuthFormState> {
  return { ...(await resendVerificationCodeInner()), attempt: Date.now() };
}

export async function resendResetCode(): Promise<AuthFormState> {
  return { ...(await resendResetCodeInner()), attempt: Date.now() };
}
