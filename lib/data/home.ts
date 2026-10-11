import "server-only";

import { createClient } from "@/lib/supabase/server";
import { reconcileDuePosts } from "@/lib/social/service";
import { listPosts } from "./posts";

/** Reconcile scheduled posts with the provider, but never hold the page for long. */
export async function reconcileQuietly(userId: string, budgetMs = 2500) {
  await Promise.race([reconcileDuePosts(userId).catch(() => 0), new Promise((r) => setTimeout(r, budgetMs))]);
}

export async function getHomeData(userId: string) {
  await reconcileQuietly(userId);
  const supabase = await createClient();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [needsReview, upcoming, published, failed, stories, reviewCount, weekCount, attention] = await Promise.all([
    listPosts(userId, { statuses: ["awaiting_review", "draft"], limit: 4, order: "updated" }),
    listPosts(userId, { statuses: ["scheduled"], scheduledFrom: now.toISOString(), limit: 6, order: "scheduled" }),
    listPosts(userId, { statuses: ["published"], limit: 4, order: "published" }),
    listPosts(userId, { statuses: ["failed"], limit: 3, order: "updated" }),
    supabase
      .from("stories")
      .select("id,title,source_text,status,created_at,story_posts(platform,status)")
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase.from("story_posts").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["awaiting_review", "draft"]),
    supabase
      .from("story_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("scheduled_for", now.toISOString())
      .lt("scheduled_for", weekAhead.toISOString()),
    supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["reconnect_required", "error"]),
  ]);

  return {
    needsReview,
    upcoming,
    published,
    failed,
    stories: stories.data ?? [],
    counts: {
      review: reviewCount.count ?? 0,
      week: weekCount.count ?? 0,
      attention: attention.count ?? 0,
    },
  };
}
