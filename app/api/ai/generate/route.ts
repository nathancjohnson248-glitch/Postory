import type { NextRequest } from "next/server";
import { z } from "zod";
import { toFailure } from "@/app/_actions/_run";
import { aiAvailable } from "@/lib/ai/client";
import { factCorpus, loadBusinessContext } from "@/lib/ai/context";
import { generatePosts } from "@/lib/ai/generate-posts";
import { getSessionUser } from "@/lib/auth/session";
import { consumePreviewGeneration, consumeUsage, getEntitlements } from "@/lib/entitlements";
import { UserFacingError } from "@/lib/errors";
import { log } from "@/lib/log";
import { listConnectedAccounts } from "@/lib/social/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CreateStorySchema, idSchema, platformSchema } from "@/lib/validation/schemas";

export const maxDuration = 120;

/** Onboarding's first story may run before a plan exists, on up to this many networks. */
const PREVIEW_MAX_PLATFORMS = 4;

const RequestSchema = z.union([
  CreateStorySchema.extend({ storyId: z.undefined().optional(), onboarding: z.boolean().optional() }),
  z.object({ storyId: idSchema, platforms: z.array(platformSchema).min(1).max(8) }),
]);

type Event =
  | { type: "story"; storyId: string }
  | { type: "stage"; stage: "understanding" | "writing" | "checking" | "saving" }
  | { type: "done"; storyId: string; posts: number; missingPlatforms: string[] }
  | { type: "needs_detail"; questions: string[] }
  | { type: "error"; error: { code: string; message: string; action?: { label: string; href: string } } };

/**
 * Turn a story into platform posts. Streams newline-delimited JSON events
 * that mirror the real steps, so the UI shows honest progress:
 *   understanding → (model) writing → checking → saving → done
 * The story is saved before generation, so it survives an AI failure.
 */
async function inOnboarding(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle();
  return data?.onboarding_completed === false;
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: { code: "unauthenticated", message: "Log in again." } }, { status: 401 });
  if (!aiAvailable()) {
    return Response.json(
      { error: { code: "not_configured", message: "Postory's writer isn't switched on yet. Try again soon." } },
      { status: 503 },
    );
  }

  const parsedBody = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return Response.json({ error: { code: "invalid_input", message: parsedBody.error.issues[0]?.message ?? "Invalid request." } }, { status: 400 });
  }
  const body = parsedBody.data;
  const platforms = [...new Set(body.platforms)];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const supabase = await createClient();
      let storyId: string | null = body.storyId ?? null;
      let release: (() => Promise<void>) | null = null;
      // Adding networks to a story that already has posts keeps its title, summary and angles.
      let addingToExisting = false;

      try {
        const entitlements = await getEntitlements(user.id);

        // 1. Save the story (or load the existing one).
        let sourceText: string;
        if (storyId) {
          const { data: story } = await supabase.from("stories").select("id,source_text").eq("id", storyId).eq("user_id", user.id).maybeSingle();
          if (!story) throw new Error("not_found");
          const { data: existing } = await supabase.from("story_posts").select("platform").eq("story_id", storyId).eq("user_id", user.id);
          const written = new Set((existing ?? []).map((p) => p.platform));
          addingToExisting = written.size > 0;
          const remaining = platforms.filter((p) => !written.has(p));
          if (!remaining.length) {
            send({ type: "error", error: { code: "already_generated", message: "This story already has posts for those networks. Regenerate individual posts instead." } });
            controller.close();
            return;
          }
          platforms.splice(0, platforms.length, ...remaining);
          sourceText = story.source_text;
        } else {
          const create = body as z.infer<typeof CreateStorySchema>;
          const { data: story, error } = await supabase
            .from("stories")
            .insert({ user_id: user.id, title: "New story", source_text: create.sourceText, source_type: create.sourceType, status: "processing" })
            .select("id")
            .single();
          if (error || !story) throw error ?? new Error("story insert failed");
          storyId = story.id;
          sourceText = create.sourceText;
        }
        send({ type: "story", storyId });

        // 2. Check plan + reserve a generation. Onboarding gets a small preview allowance.
        send({ type: "stage", stage: "understanding" });
        const preview = !entitlements.active && "onboarding" in body && body.onboarding === true && (await inOnboarding(user.id));
        if (preview && platforms.length > PREVIEW_MAX_PLATFORMS) {
          throw new UserFacingError("too_many_networks", `Pick up to ${PREVIEW_MAX_PLATFORMS} networks for your first story.`);
        }
        const usage = preview ? await consumePreviewGeneration(user.id) : await consumeUsage(user.id, entitlements, "ai_generation");
        release = usage.release;
        if (!addingToExisting) await supabase.from("stories").update({ status: "processing" }).eq("id", storyId);
        const context = await loadBusinessContext(user.id);

        // 3. Write.
        send({ type: "stage", stage: "writing" });
        const result = await generatePosts({ story: sourceText, platforms, context, corpus: factCorpus(context, sourceText), askWhenThin: true });

        // Too vague to write without guessing: ask instead, and don't charge for it.
        if (result.needsMoreDetail) {
          await release();
          release = null;
          if (body.storyId) await supabase.from("stories").update({ status: addingToExisting ? "ready" : "draft" }).eq("id", storyId).eq("user_id", user.id);
          // A story created just now holds nothing but the text still in the composer.
          else await supabase.from("stories").delete().eq("id", storyId).eq("user_id", user.id);
          send({ type: "needs_detail", questions: result.missingInformation });
          return;
        }

        // 4. Check (validation + fact check already ran in generatePosts; this marks the step).
        send({ type: "stage", stage: "checking" });

        // 5. Save posts, each pointed at the user's connected account for that network.
        send({ type: "stage", stage: "saving" });
        const accounts = await listConnectedAccounts(user.id);
        const accountFor = (platform: string) => accounts.find((a) => a.platform === platform && a.status === "connected")?.id ?? null;
        const admin = createAdminClient();
        const { error: postsError } = await admin.from("story_posts").insert(
          result.posts.map((p) => ({
            story_id: storyId!,
            user_id: user.id,
            platform: p.platform,
            content: p.content,
            generated_content: p.content,
            angle: p.angle || null,
            reasoning: p.reasoning || null,
            media_suggestion: p.mediaNeeded ? p.mediaSuggestion : null,
            social_account_id: accountFor(p.platform),
            status: "awaiting_review",
            last_edited_by: "ai",
          })),
        );
        if (postsError) throw postsError;
        if (addingToExisting) {
          send({ type: "done", storyId, posts: result.posts.length, missingPlatforms: result.missingPlatforms });
          return;
        }
        // Angles are written only by the server (users can't edit them directly), so the angle picker can trust them.
        await createAdminClient()
          .from("stories")
          .update({
            title: result.storyTitle,
            summary: result.summary,
            status: "ready",
            angles: {
              facts: result.facts,
              angles: result.angles,
              missingInformation: result.missingInformation,
              schedulingSuggestion: result.schedulingSuggestion,
            },
          })
          .eq("id", storyId)
          .eq("user_id", user.id);

        send({ type: "done", storyId, posts: result.posts.length, missingPlatforms: result.missingPlatforms });
      } catch (error) {
        if (release) await release();
        if (storyId && !addingToExisting) await supabase.from("stories").update({ status: "draft" }).eq("id", storyId).eq("user_id", user.id);
        const failure = toFailure(error, "ai.generate", user.id);
        if (failure.error.code === "unexpected") log.error("generation failed", { operation: "ai.generate", userId: user.id, resourceId: storyId }, error);
        send({ type: "error", error: failure.error });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
