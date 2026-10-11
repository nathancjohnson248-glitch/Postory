import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { ConfigurationError, env } from "@/lib/env";

/**
 * Supabase client bound to the signed-in user's session cookies.
 * Every query runs under the user's JWT, so Row Level Security applies.
 */
export async function createClient() {
  const url = env.supabaseUrl();
  const key = env.supabasePublishableKey();
  if (!url || !key) throw new ConfigurationError("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
