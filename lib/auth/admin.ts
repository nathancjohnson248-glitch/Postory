import "server-only";

import { cache } from "react";
import { notFound } from "next/navigation";
import { integrations } from "@/lib/env";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, type SessionUser } from "./session";

/**
 * Who can see the admin area. The owner is a fixed, confirmed email address;
 * everyone else is an explicit row in `admin_users` that only the owner can
 * add. Nothing here is read from the browser.
 */
export const OWNER_EMAILS: readonly string[] = ["nqlanixx@gmail.com"];

export type AdminRole = "owner" | "admin";

export function isOwnerEmail(email: string | null | undefined) {
  return Boolean(email && OWNER_EMAILS.includes(email.trim().toLowerCase()));
}

export const getAdminRole = cache(async (user: SessionUser): Promise<AdminRole | null> => {
  if (!integrations.supabaseAdmin()) return null;
  try {
    const admin = createAdminClient();
    if (isOwnerEmail(user.email)) {
      // Re-read from Auth so the owner match rests on a confirmed address.
      const { data } = await admin.auth.admin.getUserById(user.id);
      if (data.user && isOwnerEmail(data.user.email) && data.user.email_confirmed_at) return "owner";
    }
    const { data: row } = await admin.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    return row ? "admin" : null;
  } catch (error) {
    log.error("admin role lookup failed", { operation: "auth.adminRole", userId: user.id }, error);
    return null;
  }
});

/** For admin pages: anyone else gets a plain 404, so the area isn't advertised. */
export async function requireAdmin() {
  const user = await requireUser();
  const role = await getAdminRole(user);
  if (!role) notFound();
  return { user, role };
}
