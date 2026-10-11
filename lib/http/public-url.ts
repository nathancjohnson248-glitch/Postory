import { NextResponse } from "next/server";

/**
 * The public origin a request arrived on. Behind Railway/Vercel the server
 * itself listens on an internal address (e.g. localhost:8080), so building
 * redirects from request.url would send browsers there. Prefer the forwarded
 * host, then the Host header, then NEXT_PUBLIC_APP_URL.
 */
export function publicOrigin(request: Request): string {
  const headers = request.headers;
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  const isInternal = (h: string) => /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(h);

  if (host && (!isInternal(host) || process.env.NODE_ENV === "development")) {
    const proto = first(headers.get("x-forwarded-proto")) ?? (isInternal(host) ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "https://postory.lol").replace(/\/+$/, "");
}

/** Absolute URL on the public origin for a same-site path. */
export function publicUrl(request: Request, path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, publicOrigin(request));
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, v);
  return url;
}

export function redirectTo(request: Request, path: string, params?: Record<string, string | undefined>, status = 307) {
  return NextResponse.redirect(publicUrl(request, path, params), status);
}
