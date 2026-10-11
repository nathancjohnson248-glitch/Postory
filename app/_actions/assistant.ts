"use server";

import { askAssistant } from "@/lib/ai/assistant";
import { loadBusinessContext } from "@/lib/ai/context";
import { getProfile } from "@/lib/auth/session";
import { listPosts } from "@/lib/data/posts";
import { consumeUsage, getEntitlements } from "@/lib/entitlements";
import { safeTimeZone, toZonedIso } from "@/lib/time";
import { AssistantSchema } from "@/lib/validation/schemas";
import { runAction } from "./_run";

/** One assistant turn. The assistant only proposes; the user applies each proposal. */
export async function askAssistantAction(input: { messages: { role: "user" | "assistant"; content: string }[] }) {
  return runAction("assistant.ask", async (user) => {
    const { messages } = AssistantSchema.parse(input);
    const entitlements = await getEntitlements(user.id);
    const usage = await consumeUsage(user.id, entitlements, "ai_conversation");
    try {
      const [context, profile, posts] = await Promise.all([
        loadBusinessContext(user.id),
        getProfile(user.id),
        listPosts(user.id, { statuses: ["awaiting_review", "approved", "scheduled", "published", "failed"], limit: 30, order: "updated" }),
      ]);
      const tz = safeTimeZone(profile?.timezone);
      return await askAssistant({
        messages,
        context,
        workspace: {
          now: toZonedIso(new Date(), tz),
          timezone: tz,
          posts: posts.map((p) => ({
            id: p.id,
            platform: p.platform,
            status: p.status,
            scheduledFor: p.scheduledFor ? toZonedIso(new Date(p.scheduledFor), tz) : null,
            content: p.content,
            story: p.storyTitle,
          })),
        },
      });
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}
