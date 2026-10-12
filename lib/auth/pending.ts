import "server-only";

import { cookies } from "next/headers";
import { emailSchema } from "@/lib/validation/schemas";

/**
 * Remembers which address a code was sent to between "send" and "enter the
 * code", so the code screen survives a refresh without putting the address
 * in the URL. Holding the cookie grants nothing: the code is the proof.
 */

export type PendingKind = "verify" | "reset";

const COOKIE: Record<PendingKind, string> = {
  verify: "postory_pending_verify",
  reset: "postory_pending_reset",
};

export const DEFAULT_CODE_LENGTH = 6;

/** fresh: the code confirms a brand-new account (vs. logging in to an existing one). */
export type PendingEmail = { email: string; codeLength: number; fresh: boolean };

export async function setPendingEmail(kind: PendingKind, email: string, codeLength = DEFAULT_CODE_LENGTH, fresh = true) {
  const store = await cookies();
  store.set(COOKIE[kind], JSON.stringify({ email, codeLength, fresh }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function getPendingEmail(kind: PendingKind): Promise<PendingEmail | null> {
  const raw = (await cookies()).get(COOKIE[kind])?.value;
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { email?: unknown; codeLength?: unknown; fresh?: unknown };
    const email = emailSchema.safeParse(value.email);
    if (!email.success) return null;
    const length = typeof value.codeLength === "number" && value.codeLength >= 6 && value.codeLength <= 10 ? value.codeLength : DEFAULT_CODE_LENGTH;
    return { email: email.data, codeLength: length, fresh: value.fresh !== false };
  } catch {
    return null;
  }
}

export async function clearPendingEmail(kind: PendingKind) {
  (await cookies()).delete(COOKIE[kind]);
}
