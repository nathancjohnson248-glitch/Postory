"use server";

import { revalidatePath } from "next/cache";
import { draftReply } from "@/lib/ai/assistant";
import { loadBusinessContext } from "@/lib/ai/context";
import { assertFeature, consumeUsage, getEntitlements } from "@/lib/entitlements";
import { UserFacingError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation/schemas";
import { runAction } from "./_run";

async function ownedItem(userId: string, id: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("inbox_items").select("*").eq("id", idSchema.parse(id)).eq("user_id", userId).maybeSingle();
  if (!data) throw new UserFacingError("not_found", "That conversation wasn't found.");
  return data;
}

export async function draftInboxReply(itemId: string) {
  return runAction("inbox.draft", async (user) => {
    const entitlements = await getEntitlements(user.id);
    assertFeature(entitlements, "unifiedInbox", "The inbox");
    const item = await ownedItem(user.id, itemId);
    const usage = await consumeUsage(user.id, entitlements, "ai_conversation");
    try {
      const draft = await draftReply({ comment: item.content, author: item.author_name, platform: item.platform, context: await loadBusinessContext(user.id) });
      const admin = createAdminClient();
      await admin.from("inbox_items").update({ reply_draft: draft.reply, reply_status: "drafted", category: item.category === "replied" ? "replied" : draft.category }).eq("id", item.id);
      revalidatePath("/app/inbox");
      return draft;
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}

/** The user replied themselves (e.g. after copying the draft). */
export async function markInboxReplied(itemId: string) {
  return runAction("inbox.replied", async (user) => {
    const item = await ownedItem(user.id, itemId);
    const admin = createAdminClient();
    await admin.from("inbox_items").update({ category: "replied", replied_at: new Date().toISOString() }).eq("id", item.id);
    revalidatePath("/app/inbox");
    return { ok: true };
  });
}
