import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { toFailure } from "@/app/_actions/_run";
import { createPostVisual } from "@/lib/ai/post-visual";
import { getSessionUser } from "@/lib/auth/session";
import { UserFacingError } from "@/lib/errors";
import { parseMedia } from "@/lib/posts/media";
import { publishNow } from "@/lib/social/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { idSchema } from "@/lib/validation/schemas";

export const maxDuration = 180;

const Body = z.object({
  /** Generate an image with Replicate first when the post doesn't have one. */
  visual: z.boolean().optional(),
  orientation: z.enum(["square", "portrait", "landscape"]).optional(),
});

/**
 * POST /api/posts/{postId}/publish — generate the post's visual with Replicate
 * (optional) and publish it straight away (Zernio, or Bluesky directly).
 *
 * Only for a post the signed-in owner has already approved: nothing is ever
 * published without approval. Plan limits, the double-publish guard and error
 * handling all come from the same service the app's Publish button uses.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: { code: "unauthenticated", message: "Log in again." } }, { status: 401 });

  const { postId } = await params;
  const id = idSchema.safeParse(postId);
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!id.success || !body.success) return NextResponse.json({ ok: false, error: { code: "invalid_input", message: "Invalid request." } }, { status: 400 });

  try {
    const admin = createAdminClient();
    const { data: post } = await admin
      .from("story_posts")
      .select("id,status,content,media,media_suggestion,stories(source_text)")
      .eq("id", id.data)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!post) throw new UserFacingError("not_found", "That post wasn't found.");
    if (post.status !== "approved") throw new UserFacingError("not_approved", "Approve this post before publishing it.");

    // 1. Replicate: the visual, if asked for and the post has none yet.
    if (body.data.visual && parseMedia(post.media).length === 0) {
      await createPostVisual(user.id, { ...post, stories: post.stories as { source_text: string } | null }, { orientation: body.data.orientation });
    }

    // 2. Publish to the network now.
    const published = await publishNow(user.id, post.id);
    return NextResponse.json({ ok: true, data: { status: published.status, url: published.external_url } });
  } catch (error) {
    const failure = toFailure(error, "api.posts.publish", user.id);
    return NextResponse.json(failure, { status: failure.error.code === "unexpected" ? 500 : 400 });
  }
}
