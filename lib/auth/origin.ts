import "server-only";

import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Origin of the current request, for auth redirect URLs. Supabase only honours
 * redirect URLs on its allow-list, so a spoofed host can't redirect elsewhere.
 */
export async function requestOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return env.appUrl();
}
