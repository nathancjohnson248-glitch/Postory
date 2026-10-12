"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelSubscription, getSubscriptionRow } from "@/lib/billing/service";
import { billingAvailability } from "@/lib/billing/service";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { MEDIA_BUCKET } from "@/lib/posts/media";
import { PLATFORMS } from "@/lib/social/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BusinessSchema, ProfileSchema, VoiceSchema, firstError } from "@/lib/validation/schemas";
import { runAction } from "./_run";

export async function updateProfileSettings(input: { name: string; timezone: string }) {
  return runAction("settings.profile", async (user) => {
    const parsed = ProfileSchema.safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", firstError(parsed.error));
    const supabase = await createClient();
    await supabase.from("profiles").update({ name: parsed.data.name, timezone: parsed.data.timezone }).eq("id", user.id);
    revalidatePath("/app", "layout");
    return { saved: true };
  });
}

export async function updateBusinessSettings(input: Record<string, string>) {
  return runAction("settings.business", async (user) => {
    const parsed = BusinessSchema.omit({ timezone: true }).safeParse(input);
    if (!parsed.success) throw new UserFacingError("invalid", firstError(parsed.error));
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({
        business_name: parsed.data.businessName,
        business_description: parsed.data.businessDescription,
        business_type: parsed.data.businessType,
        website_url: parsed.data.websiteUrl,
      })
      .eq("id", user.id);
    revalidatePath("/app", "layout");
    return { saved: true };
  });
}

export async function updateVoiceSettings(input: { presets: string[]; notes: string }) {
  return runAction("settings.voice", async (user) => {
    const parsed = VoiceSchema.parse(input);
    const supabase = await createClient();
    await supabase.from("business_memory").delete().eq("user_id", user.id).eq("category", "voice").in("key", ["tone", "notes"]);
    const rows = [
      parsed.presets.length ? { key: "tone", value: parsed.presets.join(", ") } : null,
      parsed.notes ? { key: "notes", value: parsed.notes } : null,
    ].filter((r): r is { key: string; value: string } => r !== null);
    if (rows.length) {
      await supabase.from("business_memory").insert(rows.map((r) => ({ ...r, user_id: user.id, category: "voice", source: "user" })));
    }
    revalidatePath("/app/settings");
    return { saved: true };
  });
}

const AiPreferencesSchema = z.object({
  defaultPlatforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length),
  emoji: z.enum(["never", "sparingly", "voice"]),
  hashtags: z.enum(["never", "sparingly", "platform"]),
});

export async function updateAiPreferences(input: z.input<typeof AiPreferencesSchema>) {
  return runAction("settings.ai", async (user) => {
    const parsed = AiPreferencesSchema.parse(input);
    const supabase = await createClient();
    await supabase.from("profiles").update({ ai_preferences: parsed }).eq("id", user.id);
    revalidatePath("/app", "layout");
    return { saved: true };
  });
}

/**
 * Permanently delete the account. Requires typing DELETE. Billing is cancelled
 * first; if it can't be cancelled automatically we stop rather than leave a
 * live subscription behind. Rows cascade from auth.users; media files are
 * removed from Storage explicitly.
 */
export async function deleteAccount(confirmation: string) {
  const result = await runAction("settings.deleteAccount", async (user) => {
    if (confirmation !== "DELETE") throw new UserFacingError("confirm", "Type DELETE to confirm.");

    const subscription = await getSubscriptionRow(user.id);
    const live = subscription && ["trialing", "active", "past_due"].includes(subscription.status) && !subscription.cancel_at_period_end;
    if (live) {
      if (!billingAvailability().cancel) {
        throw new UserFacingError("subscription_active", "Cancel your subscription before deleting your account.", {
          label: "Open billing",
          href: "/app/billing",
        });
      }
      await cancelSubscription(user.id);
    }

    const admin = createAdminClient();
    // Remove media: <user>/<post>/<file>
    const { data: folders } = await admin.storage.from(MEDIA_BUCKET).list(user.id, { limit: 1000 });
    for (const folder of folders ?? []) {
      const { data: files } = await admin.storage.from(MEDIA_BUCKET).list(`${user.id}/${folder.name}`, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${user.id}/${folder.name}/${f.name}`);
      if (paths.length) await admin.storage.from(MEDIA_BUCKET).remove(paths);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      log.error("account deletion failed", { operation: "settings.deleteAccount", userId: user.id }, error);
      throw new UserFacingError("delete_failed", "We couldn't delete your account. Nothing was removed — try again or contact support.");
    }
    const supabase = await createClient();
    await supabase.auth.signOut();
    return { deleted: true };
  });
  if (result.ok) redirect("/?account=deleted");
  return result;
}

export async function updateNotificationSettings(input: { productUpdates: boolean }) {
  return runAction("settings.notifications", async (user) => {
    const productUpdates = z.boolean().parse(input.productUpdates);
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ product_updates: productUpdates }).eq("id", user.id);
    if (error) throw error;
    revalidatePath("/app/settings");
    return { saved: true };
  });
}
