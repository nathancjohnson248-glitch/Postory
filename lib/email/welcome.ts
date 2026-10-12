import "server-only";

import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { sendEmail } from "./send";

/**
 * The founder welcome note goes out once, right after an account is created
 * and confirmed. It's sent after the response so signup never waits on mail.
 */
export function sendWelcomeEmail(user: Pick<User, "email" | "user_metadata"> | null | undefined, fallbackName?: string | null) {
  const email = user?.email;
  if (!email) return;
  const meta = (user?.user_metadata ?? {}) as { full_name?: unknown; name?: unknown };
  const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : (fallbackName ?? null);
  after(() => sendEmail(email, "welcome", { name }));
}

/** An OAuth sign-in that just created the account (first sign-in moments after creation). */
export function isFirstSignIn(user: Pick<User, "created_at" | "last_sign_in_at">) {
  const created = Date.parse(user.created_at);
  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : created;
  return Number.isFinite(created) && Date.now() - created < 5 * 60_000 && Math.abs(lastSignIn - created) < 30_000;
}
