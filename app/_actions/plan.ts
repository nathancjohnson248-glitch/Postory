"use server";

import { revalidatePath } from "next/cache";
import { loadBusinessContext } from "@/lib/ai/context";
import { planContent } from "@/lib/ai/planner";
import { assertActivePlan, consumeUsage, getEntitlements } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatInZone, safeTimeZone } from "@/lib/time";
import { runAction } from "./_run";

/** Plan the next week (two weeks on Pro and Max) from memory, recent stories and the schedule. Counts as one AI conversation. */
export async function generatePlanAction() {
  return runAction("plan.generate", async (user) => {
    const entitlements = await getEntitlements(user.id);
    assertActivePlan(entitlements);
    const horizonDays = entitlements.features.advancedPlanning ? 14 : 7;
    const admin = createAdminClient();
    const since = new Date(Date.now() - 45 * 86_400_000).toISOString();
    const [context, { data: profile }, { data: accounts }, { data: stories }, { data: scheduled }, { data: published }] = await Promise.all([
      loadBusinessContext(user.id),
      admin.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
      admin.from("social_accounts").select("platform").eq("user_id", user.id).eq("status", "connected"),
      admin.from("stories").select("title,summary,created_at,story_posts(platform,status)").eq("user_id", user.id).is("archived_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(15),
      admin.from("story_posts").select("platform,scheduled_for,stories(title)").eq("user_id", user.id).eq("status", "scheduled").order("scheduled_for").limit(30),
      admin.from("story_posts").select("platform,published_at").eq("user_id", user.id).eq("status", "published").order("published_at", { ascending: false }).limit(100),
    ]);
    const tz = safeTimeZone(profile?.timezone);
    const fmt = (iso: string) => formatInZone(new Date(iso), tz, { weekday: "short", month: "short", day: "numeric" });
    const connected = [...new Set((accounts ?? []).map((a) => a.platform))];
    const lastPostedByNetwork: Record<string, string | null> = Object.fromEntries(connected.map((p) => [p, null]));
    for (const p of published ?? []) if (p.published_at && !lastPostedByNetwork[p.platform]) lastPostedByNetwork[p.platform] = fmt(p.published_at);

    const usage = await consumeUsage(user.id, entitlements, "ai_conversation");
    try {
      const plan = await planContent({
        context,
        horizonDays,
        today: formatInZone(new Date(), tz, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        connected,
        recentStories: ((stories ?? []) as unknown as { title: string; summary: string | null; created_at: string; story_posts: { platform: string; status: string }[] }[]).map((s) => ({
          title: s.title,
          summary: s.summary,
          createdAt: fmt(s.created_at),
          networks: [...new Set(s.story_posts.filter((p) => p.status === "published").map((p) => p.platform))],
        })),
        scheduled: ((scheduled ?? []) as unknown as { platform: string; scheduled_for: string; stories: { title: string } | null }[]).map((s) => ({
          platform: s.platform,
          when: fmt(s.scheduled_for),
          story: s.stories?.title ?? "",
        })),
        lastPostedByNetwork,
      });
      await admin.from("content_plans").insert({ user_id: user.id, horizon_days: horizonDays, plan });
      revalidatePath("/app/plan");
      return plan;
    } catch (error) {
      await usage.release();
      throw error;
    }
  });
}
