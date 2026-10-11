"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { UserFacingError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/schemas";
import { runAction } from "./_run";

export async function renameStory(storyId: string, title: string) {
  return runAction("stories.rename", async (user) => {
    const clean = z.string().trim().min(1, "Give the story a title.").max(120).parse(title);
    const supabase = await createClient();
    await supabase.from("stories").update({ title: clean }).eq("id", idSchema.parse(storyId)).eq("user_id", user.id);
    revalidatePath(`/app/library/${storyId}`);
    revalidatePath("/app/library");
    return { title: clean };
  });
}

export async function archiveStory(storyId: string) {
  return runAction("stories.archive", async (user) => {
    const supabase = await createClient();
    const id = idSchema.parse(storyId);
    const { count } = await supabase
      .from("story_posts")
      .select("id", { count: "exact", head: true })
      .eq("story_id", id)
      .in("status", ["scheduled", "publishing"]);
    if (count) throw new UserFacingError("has_scheduled", "This story has scheduled posts. Unschedule them before archiving.");
    await supabase.from("stories").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
    revalidatePath("/app", "layout");
    return { archived: true };
  });
}

export async function restoreStory(storyId: string) {
  return runAction("stories.restore", async (user) => {
    const supabase = await createClient();
    const id = idSchema.parse(storyId);
    const { count } = await supabase.from("story_posts").select("id", { count: "exact", head: true }).eq("story_id", id);
    await supabase
      .from("stories")
      .update({ status: count ? "ready" : "draft", archived_at: null })
      .eq("id", id)
      .eq("user_id", user.id);
    revalidatePath("/app", "layout");
    return { restored: true };
  });
}

export async function deleteStory(storyId: string) {
  const result = await runAction("stories.delete", async (user) => {
    const supabase = await createClient();
    const id = idSchema.parse(storyId);
    const { count } = await supabase
      .from("story_posts")
      .select("id", { count: "exact", head: true })
      .eq("story_id", id)
      .in("status", ["scheduled", "publishing"]);
    if (count) throw new UserFacingError("has_scheduled", "This story has scheduled posts. Unschedule them before deleting.");
    const { error } = await supabase.from("stories").delete().eq("id", id).eq("user_id", user.id);
    if (error) throw error;
    revalidatePath("/app", "layout");
    return { deleted: true };
  });
  if (result.ok) redirect("/app/library");
  return result;
}

/**
 * Create a story with a draft per network, written by the user (no AI).
 * Each draft starts as the story text so it can be shaped per network.
 */
export async function createManualStory(input: { sourceText: string; platforms: string[] }) {
  const result = await runAction("stories.createManual", async (user) => {
    const { CreateStorySchema } = await import("@/lib/validation/schemas");
    const parsed = CreateStorySchema.safeParse({ sourceText: input.sourceText, sourceType: "manual", platforms: input.platforms });
    if (!parsed.success) throw new UserFacingError("invalid", parsed.error.issues[0]?.message ?? "Check the story and networks.");
    const supabase = await createClient();
    const title = parsed.data.sourceText.split(/[.!?\n]/)[0].trim().slice(0, 60) || "New story";
    const { data: story, error } = await supabase
      .from("stories")
      .insert({ user_id: user.id, title, source_text: parsed.data.sourceText, source_type: "manual", status: "ready" })
      .select("id")
      .single();
    if (error || !story) throw error ?? new Error("story insert failed");

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: accounts } = await admin.from("social_accounts").select("id,platform").eq("user_id", user.id).eq("status", "connected");
    const platforms = [...new Set(parsed.data.platforms)];
    const { error: postsError } = await admin.from("story_posts").insert(
      platforms.map((platform) => ({
        story_id: story.id,
        user_id: user.id,
        platform,
        content: parsed.data.sourceText,
        status: "draft",
        last_edited_by: "user",
        social_account_id: accounts?.find((a) => a.platform === platform)?.id ?? null,
      })),
    );
    if (postsError) throw postsError;
    revalidatePath("/app", "layout");
    return { storyId: story.id };
  });
  if (result.ok) redirect(`/app/library/${result.data.storyId}`);
  return result;
}
