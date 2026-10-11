"use server";

import { redirect } from "next/navigation";
import { requestOrigin } from "@/lib/auth/origin";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { SignInSchema, SignUpSchema, emailSchema, firstError, passwordSchema, safeNextPath } from "@/lib/validation/schemas";

export type AuthFormState = { error?: string; notice?: string; email?: string } | undefined;

function friendlyAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again or reset your password.";
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link we sent.";
  if (m.includes("already registered") || m.includes("already been registered")) return "An account with this email already exists. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  if (m.includes("password")) return message;
  return "Something went wrong. Try again.";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error), email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendlyAuthError(error.message), email: parsed.data.email };

  redirect(safeNextPath.parse(formData.get("next") ?? "/app"));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), email: String(formData.get("email") ?? "") };

  const supabase = await createClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`,
      data: { full_name: parsed.data.name },
    },
  });
  if (error) {
    log.warn("sign up failed", { operation: "auth.signUp" }, error);
    return { error: friendlyAuthError(error.message), email: parsed.data.email };
  }
  if (data.session) redirect("/onboarding");
  return { notice: `We sent a confirmation link to ${parsed.data.email}. Open it to finish creating your account.`, email: parsed.data.email };
}

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

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) log.warn("password reset request failed", { operation: "auth.resetRequest" }, error);
  // Same answer either way so this can't be used to discover accounts.
  return { notice: `If an account exists for ${parsed.data}, a reset link is on its way.` };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: friendlyAuthError(error.message) };
  redirect("/app");
}
