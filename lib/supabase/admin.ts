import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ConfigurationError, env } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security, so it is only ever used on
 * the server after the caller's identity and ownership have been verified.
 * Never import this from a Client Component.
 */
export function createAdminClient() {
  const url = env.supabaseUrl();
  const key = env.supabaseSecretKey();
  if (!url || !key) throw new ConfigurationError("SUPABASE_SECRET_KEY");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
