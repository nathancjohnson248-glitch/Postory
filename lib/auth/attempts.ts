import "server-only";

/**
 * Brute-force guard for password and code checks. Supabase only sees the
 * server's own IP, so its per-IP limits can't tell attackers apart; this
 * counts failures per target address instead. In memory: Postory runs as a
 * single Node process, and a restart only resets the window.
 */

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;
const failures = new Map<string, { count: number; first: number }>();

function key(kind: string, email: string) {
  return `${kind}:${email.trim().toLowerCase()}`;
}

/** Minutes until another try is allowed, or 0 if it's allowed now. */
export function lockedFor(kind: "password" | "code" | "reset", email: string) {
  const entry = failures.get(key(kind, email));
  if (!entry) return 0;
  const left = entry.first + WINDOW_MS - Date.now();
  if (left <= 0) {
    failures.delete(key(kind, email));
    return 0;
  }
  return entry.count >= MAX_FAILURES ? Math.ceil(left / 60_000) : 0;
}

export function recordFailure(kind: "password" | "code" | "reset", email: string) {
  const k = key(kind, email);
  const entry = failures.get(k);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(k, { count: 1, first: Date.now() });
  else entry.count += 1;
  if (failures.size > 20_000) failures.clear();
}

export function clearFailures(kind: "password" | "code" | "reset", email: string) {
  failures.delete(key(kind, email));
}

export const lockedMessage = (minutes: number) => `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`;
