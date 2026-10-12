import "server-only";

import { loadBusinessContext } from "@/lib/ai/context";
import { generateImage } from "@/lib/ai/generate-image";
import { consumeUsage, getEntitlements } from "@/lib/entitlements";
import { MEDIA_BUCKET, parseMedia } from "@/lib/posts/media";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type VisualPost = { id: string; content: string; media: Json; media_suggestion: string | null; stories: { source_text: string } | null };

/**
 * Generate an image for a post (Replicate first, see lib/ai/llm.ts), store it
 * in the user's own Storage folder and attach it to the post. Uses one AI image
 * from the plan, given back if anything fails.
 */
export async function createPostVisual(userId: string, post: VisualPost, options: { direction?: string; orientation?: "square" | "portrait" | "landscape" } = {}) {
  const entitlements = await getEntitlements(userId);
  const usage = await consumeUsage(userId, entitlements, "ai_image");
  try {
    const context = await loadBusinessContext(userId);
    const image = await generateImage({
      story: post.stories?.source_text ?? "",
      post: post.content,
      suggestion: post.media_suggestion,
      businessName: context.businessName,
      direction: options.direction,
      orientation: options.orientation ?? "square",
    });
    const id = crypto.randomUUID();
    const path = `${userId}/${post.id}/${id}.${image.extension}`;
    const admin = createAdminClient();
    const { error } = await admin.storage.from(MEDIA_BUCKET).upload(path, image.bytes, { contentType: image.contentType });
    if (error) throw new Error("Could not store the generated image.");
    const media = [
      ...parseMedia(post.media),
      { id, kind: "image" as const, storagePath: path, contentType: image.contentType, source: "ai" as const, createdAt: new Date().toISOString() },
    ];
    await admin.from("story_posts").update({ media }).eq("id", post.id).eq("user_id", userId);
    return { mediaId: id };
  } catch (error) {
    await usage.release();
    throw error;
  }
}
