"use server";

import { revalidatePath } from "next/cache";
import { getAdminRole, isOwnerEmail } from "@/lib/auth/admin";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation/schemas";
import { runAction } from "./_run";

async function assertOwner(user: Parameters<typeof getAdminRole>[0]) {
  if ((await getAdminRole(user)) !== "owner") throw new UserFacingError("forbidden", "Only the owner can manage admins.");
}

export async function promoteToAdmin(targetId: string) {
  return runAction("admin.promote", async (user) => {
    await assertOwner(user);
    const id = idSchema.safeParse(targetId);
    if (!id.success) throw new UserFacingError("invalid_user", "Unknown user.");
    if (id.data === user.id) throw new UserFacingError("self", "You're already the owner.");

    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(id.data);
    const target = data.user;
    if (!target) throw new UserFacingError("not_found", "That user no longer exists.");
    if (!target.email_confirmed_at) throw new UserFacingError("unconfirmed", "That user hasn't confirmed their email yet.");
    if (isOwnerEmail(target.email)) throw new UserFacingError("owner", "That account is already the owner.");

    const { error } = await admin.from("admin_users").upsert({ user_id: id.data, granted_by: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error) throw error;
    log.info("admin granted", { operation: "admin.promote", userId: user.id, resourceId: id.data });
    revalidatePath("/app/admin");
    return { email: target.email ?? null };
  });
}

export async function revokeAdmin(targetId: string) {
  return runAction("admin.revoke", async (user) => {
    await assertOwner(user);
    const id = idSchema.safeParse(targetId);
    if (!id.success) throw new UserFacingError("invalid_user", "Unknown user.");
    const { error } = await createAdminClient().from("admin_users").delete().eq("user_id", id.data);
    if (error) throw error;
    log.info("admin revoked", { operation: "admin.revoke", userId: user.id, resourceId: id.data });
    revalidatePath("/app/admin");
    return null;
  });
}
