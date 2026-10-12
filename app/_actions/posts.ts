"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adaptPost } from "@/lib/ai/adapt-post";
import { factCorpus, loadBusinessContext } from "@/lib/ai/context";
import { generateImage } from "@/lib/ai/generate-image";
import { generatePosts } from "@/lib/ai/generate-posts";
import { consumeUsage, getEntitlements } from "@/lib/entitlements";
import { UserFacingError } from "@/lib/errors";
import { ALLOWED_MEDIA_TYPES, MEDIA_BUCKET, parseMedia, type PostMedia } from "@/lib/posts/media";
import { assertTransition, isEditable, statusAfterEdit, type PostStatus } from "@/lib/posts/state-machine";
import * as social from "@/lib/social/service";
import type { Platform } from "@/lib/social/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdaptPostSchema, EditPostSchema, ScheduleSchema, idSchema } from "@/lib/validation/schemas";
import { runAction } from "./_run";

async function ownedPost(userId: string, postId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("story_posts")
    .select("*, stories(id,title,source_text)")
    .eq("id", idSchema.parse(postId))
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new UserFacingError("not_found", "That post wasn't found.");
  return data as typeof data & { status: PostStatus; stories: { id: string; title: string; source_text: string } | null };
}

function refresh(storyId: string) {
  revalidatePath(`/app/library/${storyId}`);
  revalidatePath("/app", "layout");
}

export async function updatePostContent(input: { postId: string; content: string; expectedVersion: number }) {
  return runAction("posts.edit", async (user) => {
    const { postId, content, expectedVersion } = EditPostSchema.parse(input);
    const post = await ownedPost(user.id, postId);
    if (!isEditable(post.status)) {
      throw new UserFacingError("not_editable", post.status === "scheduled" ? "Unschedule this post to edit it." : "This post can't be edited any more.");
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("story_posts")
      .update({ content, last_edited_by: "user", status: statusAfterEdit(post.status, "user"), version: post.version + 1, error_code: null, error_message: null })
      .eq("id", post.id)
      .eq("user_id", user.id)
      .eq("version", expectedVersion)
      .select("version,status")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new UserFacingError("stale", "This post changed somewhere else. Refresh to see the latest version.");
    refresh(post.story_id);
    return data;
  });
}

const STATUS_ACTIONS = z.enum(["approved", "rejected", "awaiting_review"]);

export async function setPostStatus(postId: string, status: string) {
  return runAction("posts.status", async (user) => {
    const target = STATUS_ACTIONS.parse(status) as PostStatus;
    const post = await ownedPost(user.id, postId);
    if (post.status === target) return { status: target };
    assertTransition(post.status, target);
    const admin = createAdminClient();
    const { data } = await admin
      .from("story_posts")
      .update({ status: target })
      .eq("id", post.id)
      .eq("user_id", user.id)
      .eq("status", post.status)
      .select("status")
      .maybeSingle();
    if (!data) throw new UserFacingError("stale", "This post changed somewhere else. Refresh and try again.");
    refresh(post.story_id);
    return data;
  });
}

export async function approveAllInStory(storyId: string) {
  return runAction("posts.approveAll", async (user) => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("story_posts")
      .update({ status: "approved" })
      .eq("story_id", idSchema.parse(storyId))
      .eq("user_id", user.id)
      .in("status", ["awaiting_review", "draft"])
      .select("id");
    refresh(storyId);
    return { approved: data?.length ?? 0 };
  });
}

export async function setPostAccount(postId: string, socialAccountId: string | null) {
  return runAction("posts.account", async (user) => {
    const post = await ownedPost(user.id, postId);
    if (post.status === "scheduled" || post.status === "publishing" || post.status === "published") {
      throw new UserFacingError("not_editable", "The account can't change after a post is scheduled or published.");
    }
    const admin = createAdminClient();
    if (socialAccountId) {
      const { data: account } = await admin
        .from("social_accounts")
        .select("id,platform,status")
        .eq("id", idSchema.parse(socialAccountId))
        .eq("user_id", user.id)
        .maybeSingle();
      if (!account || account.platform !== post.platform || account.status === "disconnected") {
        throw new UserFacingError("invalid_account", "Choose a connected account for this network.");
      }
    }
    await admin.from("story_posts").update({ social_account_id: socialAccountId }).eq("id", post.id).eq("user_id", user.id);
    refresh(post.story_id);
    return { ok: true };
  });
}

/** "Make the X version more chaotic" — changes only this post. */
export async function adaptPostAction(input: { postId: string; instruction: string }) {
  return runAction("posts.adapt", async (user) => {
    const { postId, instruction } = AdaptPostSchema.parse(input);
    const post = await ownedPost(user.id, postId);
    if (!isEditable(post.status)) throw new UserFacingError("not_editable", "Unschedule this post before changing it.");

    const entitlements = await getEntitlements(user.id);
    const usage = await consumeUsage(user.id, entitlements, "ai_conversation");
    try {
      const context = await loadBusinessContext(user.id);
      const story = post.stories?.source_text ?? "";
      const result = await adaptPost({
        platform: post.platform as Platform,
        story,
        current: post.content,
        instruction,
        context,
        corpus: factCorpus(context, story),
      });
      const admin = createAdminClient();
      const { data } = await admin
        .from("story_posts")
        .update({ content: result.content, last_edited_by: "ai", status: statusAfterEdit(post.status, "ai"), version: post.version + 1 })
        .eq("id", post.id)
        .eq("user_id", user.id)
        .eq("version", post.version)
        .select("version,status")
        .maybeSingle();
      if (!data) throw new UserFacingError("stale", "This post changed while Postory was editing it. Refresh and try again.");
      refresh(post.story_id);
      return { content: result.content, summary: result.changeSummary, warnings: result.warnings, ...data };
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}

export async function regeneratePost(postId: string) {
  return runAction("posts.regenerate", async (user) => {
    const post = await ownedPost(user.id, postId);
    if (!isEditable(post.status)) throw new UserFacingError("not_editable", "Unschedule this post before regenerating it.");
    const entitlements = await getEntitlements(user.id);
    const usage = await consumeUsage(user.id, entitlements, "ai_generation");
    try {
      const context = await loadBusinessContext(user.id);
      const story = post.stories?.source_text ?? "";
      const result = await generatePosts({ story, platforms: [post.platform as Platform], context, corpus: factCorpus(context, story) });
      const fresh = result.posts[0];
      const admin = createAdminClient();
      await admin
        .from("story_posts")
        .update({
          content: fresh.content,
          generated_content: fresh.content,
          angle: fresh.angle,
          reasoning: fresh.reasoning,
          media_suggestion: fresh.mediaNeeded ? fresh.mediaSuggestion : null,
          last_edited_by: "ai",
          status: "awaiting_review",
          version: post.version + 1,
          error_code: null,
          error_message: null,
        })
        .eq("id", post.id)
        .eq("user_id", user.id);
      refresh(post.story_id);
      return { content: fresh.content };
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}

/**
 * Rewrite a story's open drafts around one of its angles. Approved, scheduled
 * and published posts are left exactly as they are.
 */
export async function rewriteStoryAroundAngle(input: { storyId: string; angle: string }) {
  return runAction("posts.angle", async (user) => {
    const storyId = idSchema.parse(input.storyId);
    const admin = createAdminClient();
    const { data: story } = await admin.from("stories").select("id,source_text,angles").eq("id", storyId).eq("user_id", user.id).maybeSingle();
    if (!story) throw new UserFacingError("not_found", "That story doesn't exist any more.");
    const raw = story.angles as { angles?: unknown } | unknown[] | null;
    const known = (Array.isArray(raw) ? raw : Array.isArray(raw?.angles) ? raw.angles : []).filter((a): a is string => typeof a === "string");
    // Only an angle Postory found for this story — never free text from the browser.
    const angle = known.find((a) => a === input.angle);
    if (!angle) throw new UserFacingError("invalid", "Pick one of this story's angles.");

    const { data: drafts } = await admin
      .from("story_posts")
      .select("id,platform,version,status")
      .eq("story_id", storyId)
      .eq("user_id", user.id)
      .in("status", ["draft", "awaiting_review", "rejected"]);
    if (!drafts?.length) throw new UserFacingError("nothing_to_rewrite", "Every post here is already approved or scheduled. Move one back to review to rewrite it.");

    const entitlements = await getEntitlements(user.id);
    const usage = await consumeUsage(user.id, entitlements, "ai_generation");
    try {
      const context = await loadBusinessContext(user.id);
      const platforms = [...new Set(drafts.map((d) => d.platform as Platform))];
      const result = await generatePosts({ story: story.source_text, platforms, context, corpus: factCorpus(context, story.source_text), angle });
      let rewritten = 0;
      for (const fresh of result.posts) {
        const target = drafts.find((d) => d.platform === fresh.platform);
        if (!target) continue;
        const { data } = await admin
          .from("story_posts")
          .update({
            content: fresh.content,
            generated_content: fresh.content,
            angle,
            reasoning: fresh.reasoning,
            media_suggestion: fresh.mediaNeeded ? fresh.mediaSuggestion : null,
            last_edited_by: "ai",
            status: "awaiting_review",
            version: target.version + 1,
          })
          .eq("id", target.id)
          .eq("user_id", user.id)
          .eq("version", target.version)
          .select("id")
          .maybeSingle();
        if (data) rewritten += 1;
      }
      refresh(storyId);
      return { rewritten, warnings: result.posts.flatMap((p) => p.warnings) };
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}

export async function publishPostNow(postId: string) {
  return runAction("posts.publish", async (user) => {
    const post = await social.publishNow(user.id, idSchema.parse(postId));
    refresh(post.story_id);
    revalidatePath("/app/calendar");
    return { status: post.status, url: post.external_url };
  });
}

export async function schedulePostAction(input: { postId: string; scheduledFor: string }) {
  return runAction("posts.schedule", async (user) => {
    const { postId, scheduledFor } = ScheduleSchema.parse(input);
    const post = await social.schedulePost(user.id, postId, scheduledFor);
    refresh(post.story_id);
    revalidatePath("/app/calendar");
    return { scheduledFor: post.scheduled_for };
  });
}

export async function reschedulePostAction(input: { postId: string; scheduledFor: string }) {
  return runAction("posts.reschedule", async (user) => {
    const { postId, scheduledFor } = ScheduleSchema.parse(input);
    const post = await social.reschedulePost(user.id, postId, scheduledFor);
    refresh(post.story_id);
    revalidatePath("/app/calendar");
    return { scheduledFor: post.scheduled_for };
  });
}

export async function unschedulePostAction(postId: string) {
  return runAction("posts.unschedule", async (user) => {
    const post = await social.unschedulePost(user.id, idSchema.parse(postId));
    refresh(post.story_id);
    revalidatePath("/app/calendar");
    return { status: post.status };
  });
}

// --- Media -----------------------------------------------------------------

async function saveMedia(userId: string, postId: string, media: PostMedia[]) {
  const admin = createAdminClient();
  await admin.from("story_posts").update({ media }).eq("id", postId).eq("user_id", userId);
}

export async function generateImageAction(input: { postId: string; direction?: string; orientation?: "square" | "portrait" | "landscape" }) {
  return runAction("posts.image", async (user) => {
    const post = await ownedPost(user.id, input.postId);
    if (!isEditable(post.status)) throw new UserFacingError("not_editable", "Unschedule this post before changing its media.");
    const direction = z.string().trim().max(400).optional().parse(input.direction);
    const orientation = z.enum(["square", "portrait", "landscape"]).catch("square").parse(input.orientation);

    const entitlements = await getEntitlements(user.id);
    const usage = await consumeUsage(user.id, entitlements, "ai_image");
    try {
      const context = await loadBusinessContext(user.id);
      const image = await generateImage({
        story: post.stories?.source_text ?? "",
        post: post.content,
        suggestion: post.media_suggestion,
        businessName: context.businessName,
        direction,
        orientation,
      });
      const id = crypto.randomUUID();
      const path = `${user.id}/${post.id}/${id}.${image.extension}`;
      const admin = createAdminClient();
      const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, image.bytes, { contentType: image.contentType });
      if (error) throw new Error("Could not store the generated image.");
      const media = [
        ...parseMedia(post.media),
        { id, kind: "image" as const, storagePath: path, contentType: image.contentType, source: "ai" as const, createdAt: new Date().toISOString() },
      ];
      await saveMedia(user.id, post.id, media);
      refresh(post.story_id);
      return { mediaId: id };
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}

/** Register a file the browser uploaded straight to Storage (under the user's own folder). */
export async function attachMedia(input: { postId: string; storagePath: string; altText?: string }) {
  return runAction("posts.attachMedia", async (user) => {
    const post = await ownedPost(user.id, input.postId);
    if (!isEditable(post.status)) throw new UserFacingError("not_editable", "Unschedule this post before changing its media.");
    const path = z.string().max(500).parse(input.storagePath);
    if (!path.startsWith(`${user.id}/${post.id}/`) || path.includes("..")) throw new UserFacingError("invalid_media", "That file isn't attached to this post.");

    const admin = createAdminClient();
    const folder = path.slice(0, path.lastIndexOf("/"));
    const name = path.slice(path.lastIndexOf("/") + 1);
    const { data: listing } = await admin.storage.from(MEDIA_BUCKET).list(folder, { search: name, limit: 1 });
    const object = listing?.find((o) => o.name === name);
    const contentType = (object?.metadata as { mimetype?: string } | undefined)?.mimetype ?? "";
    const kind = ALLOWED_MEDIA_TYPES[contentType];
    if (!object || !kind) throw new UserFacingError("invalid_media", "Upload a PNG, JPEG, WebP, GIF, MP4 or MOV file.");

    const media = [
      ...parseMedia(post.media),
      {
        id: crypto.randomUUID(),
        kind,
        storagePath: path,
        contentType,
        source: "upload" as const,
        altText: z.string().trim().max(1000).optional().parse(input.altText) || undefined,
        createdAt: new Date().toISOString(),
      },
    ];
    await saveMedia(user.id, post.id, media);
    refresh(post.story_id);
    return { count: media.length };
  });
}

export async function removeMedia(input: { postId: string; mediaId: string }) {
  return runAction("posts.removeMedia", async (user) => {
    const post = await ownedPost(user.id, input.postId);
    if (!isEditable(post.status)) throw new UserFacingError("not_editable", "Unschedule this post before changing its media.");
    const current = parseMedia(post.media);
    const target = current.find((m) => m.id === input.mediaId);
    if (!target) return { count: current.length };
    const remaining = current.filter((m) => m.id !== input.mediaId);
    await saveMedia(user.id, post.id, remaining);
    const admin = createAdminClient();
    // Only delete the file if no other post still references it.
    await admin.storage.from(MEDIA_BUCKET).remove([target.storagePath]);
    refresh(post.story_id);
    return { count: remaining.length };
  });
}
