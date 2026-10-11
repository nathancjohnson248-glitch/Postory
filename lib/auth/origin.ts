import "server-only";

import { headers } from "next/headers";
import { env } from "@/lib/env";

const INTERNAL = /^(https?:\/\/)?(localhost|127\.|0\.0\.0\.0|\[::1\])/;

/**
 * Public origin of the current request, for auth redirect URLs. Never returns
 * the server's internal address in production. Supabase only honours redirect
 * URLs on its allow-list, so a spoofed host can't redirect elsewhere.
 */
export async function requestOrigin() {
  const h = await headers();
  const dev = process.env.NODE_ENV === "development";
  const origin = h.get("origin");
  if (origin && /^https?:\/\//.test(origin) && (dev || !INTERNAL.test(origin))) return origin;
  const host = (h.get("x-forwarded-host") ?? h.get("host"))?.split(",")[0]?.trim();
  if (host && (dev || !INTERNAL.test(host))) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (INTERNAL.test(host) ? "http" : "https");
    return `${proto}://${host}`;
  }
  return env.appUrl();
}
