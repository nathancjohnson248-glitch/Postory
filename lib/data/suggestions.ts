import "server-only";

import { readPreferences } from "@/lib/ai/context";
import { PLATFORM_META, isPlatform } from "@/lib/social/platforms";
import { createClient } from "@/lib/supabase/server";
import { formatInZone } from "@/lib/time";

/**
 * "Postory suggests": the next useful moves, from the workspace's own data.
 * No model call and nothing invented: every suggestion points at a real post,
 * story, comment, account or pattern, and is phrased only as strongly as the
 * data supports. At most three, most urgent first.
 */

export type Suggestion = {
  id: string;
  tone: "urgent" | "opportunity" | "learning";
  title: string;
  body: string;
  action:
    | { kind: "link"; label: string; href: string }
    /** Save a preference the owner keeps expressing through their edits. */
    | { kind: "preference"; label: string; key: "hashtags" | "emoji"; value: "never" }
    | { kind: "memory"; label: string; key: string; value: string };
};

const DAY = 86_400_000;
const ANNOUNCEMENT = /launch|announce|release|update|feature|ship/i;

type StoryRow = { id: string; title: string; created_at: string; angles: unknown; story_posts: { status: string; platform: string; published_at: string | null; metrics: unknown }[] };

export async function getSuggestions(userId: string, timezone: string, aiPreferences: unknown): Promise<Suggestion[]> {
  const supabase = await createClient();
  const now = Date.now();
  const dismissed = new Set(
    Array.isArray((aiPreferences as { dismissedSuggestions?: unknown } | null)?.dismissedSuggestions)
      ? ((aiPreferences as { dismissedSuggestions: unknown[] }).dismissedSuggestions.filter((x) => typeof x === "string") as string[])
      : [],
  );
  const prefs = readPreferences(aiPreferences);

  const [{ data: scheduled }, { data: accounts }, { data: inbox }, { data: stories }, { data: edited }, { data: memory }] = await Promise.all([
    supabase.from("story_posts").select("id,platform,scheduled_for,story_id,social_account_id").eq("user_id", userId).eq("status", "scheduled").order("scheduled_for").limit(30),
    supabase.from("social_accounts").select("id,platform,status,display_name,connected_at").eq("user_id", userId).neq("status", "disconnected"),
    supabase.from("inbox_items").select("id,category").eq("user_id", userId).in("category", ["needs_reply", "potential_customer"]).limit(50),
    supabase
      .from("stories")
      .select("id,title,created_at,angles,story_posts(status,platform,published_at,metrics)")
      .eq("user_id", userId)
      .is("archived_at", null)
      .gte("created_at", new Date(now - 45 * DAY).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("story_posts")
      .select("content,generated_content")
      .eq("user_id", userId)
      .eq("last_edited_by", "user")
      .not("generated_content", "is", null)
      .in("status", ["approved", "scheduled", "published"])
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase.from("business_memory").select("key,value").eq("user_id", userId).eq("category", "voice"),
  ]);

  const out: Suggestion[] = [];
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const day = (iso: string) => formatInZone(new Date(iso), timezone, { weekday: "long" });

  // 1. A scheduled post that will fail because its account needs reconnecting.
  const atRisk = (scheduled ?? []).find((p) => p.social_account_id && accountById.get(p.social_account_id)?.status !== "connected");
  if (atRisk && atRisk.scheduled_for) {
    const name = isPlatform(atRisk.platform) ? PLATFORM_META[atRisk.platform].name : atRisk.platform;
    out.push({
      id: `reconnect-${atRisk.id}`,
      tone: "urgent",
      title: `Reconnect ${name} before ${day(atRisk.scheduled_for)}`,
      body: `A post is scheduled for ${name} on ${day(atRisk.scheduled_for)}, but the connection needs attention. It won't go out until it's reconnected.`,
      action: { kind: "link", label: `Reconnect ${name}`, href: "/app/connections" },
    });
  }

  // 2. Comments that look like someone wants to buy or has a product question.
  const leads = (inbox ?? []).filter((i) => i.category === "potential_customer").length;
  const open = (inbox ?? []).length;
  if (leads || open >= 3) {
    out.push({
      id: `inbox-${leads}-${open}`,
      tone: "urgent",
      title: leads ? `${leads} ${leads === 1 ? "comment looks" : "comments look"} like a potential customer` : `${open} comments are waiting for a reply`,
      body: leads ? "Reply while the interest is fresh. Postory can draft a first answer from your business memory." : "Postory can draft replies for you to check and send.",
      action: { kind: "link", label: "Open inbox", href: "/app/inbox" },
    });
  }

  const rows = (stories ?? []) as unknown as StoryRow[];

  // 3. Drafts that have been waiting a while.
  const waiting = rows.find(
    (s) => now - new Date(s.created_at).getTime() > 3 * DAY && s.story_posts.length > 0 && s.story_posts.every((p) => p.status === "awaiting_review" || p.status === "draft"),
  );
  if (waiting) {
    out.push({
      id: `waiting-${waiting.id}`,
      tone: "opportunity",
      title: `“${waiting.title}” is still waiting`,
      body: `${waiting.story_posts.length} ${waiting.story_posts.length === 1 ? "draft has" : "drafts have"} been ready since ${formatInZone(new Date(waiting.created_at), timezone, { month: "short", day: "numeric" })}. Approve, adjust or archive them so your queue reflects what you'll actually post.`,
      action: { kind: "link", label: "Review drafts", href: `/app/library/${waiting.id}` },
    });
  }

  // 4. A follow-up to something that went out, strongest performer first.
  const engagement = (m: unknown) => {
    const x = (m ?? {}) as { reactions?: number | null; comments?: number | null; reposts?: number | null };
    return (x.reactions ?? 0) + (x.comments ?? 0) + (x.reposts ?? 0);
  };
  const published = rows
    .map((s) => {
      const out = s.story_posts.filter((p) => p.status === "published" && p.published_at);
      const last = out.map((p) => new Date(p.published_at!).getTime()).sort((a, b) => b - a)[0];
      const followUps = ((s.angles ?? {}) as { followUps?: unknown }).followUps;
      return { story: s, last, score: out.reduce((n, p) => n + engagement(p.metrics), 0), followUps: Array.isArray(followUps) ? (followUps.filter((f) => typeof f === "string") as string[]) : [] };
    })
    .filter((s) => s.last && now - s.last > 2 * DAY && now - s.last < 21 * DAY && s.followUps.length)
    .sort((a, b) => b.score - a.score);
  const best = published[0];
  if (best && !rows.some((s) => new Date(s.created_at).getTime() > best.last)) {
    out.push({
      id: `followup-${best.story.id}`,
      tone: "opportunity",
      title: best.score > 0 ? `Follow up on “${best.story.title}”` : `“${best.story.title}” could use a follow-up`,
      body: `${best.score > 0 ? `It drew ${best.score} reactions, comments and reposts. ` : ""}${best.followUps[0]}`,
      action: { kind: "link", label: "Create follow-up", href: `/app/create?text=${encodeURIComponent(best.followUps[0])}` },
    });
  }

  // 5. A connected network that has gone quiet.
  const lastPostedOn = new Map<string, number>();
  for (const s of rows) for (const p of s.story_posts) if (p.status === "published" && p.published_at) lastPostedOn.set(p.platform, Math.max(lastPostedOn.get(p.platform) ?? 0, new Date(p.published_at).getTime()));
  const quiet = (accounts ?? [])
    .filter((a) => a.status === "connected" && isPlatform(a.platform) && PLATFORM_META[a.platform].can.publish)
    .map((a) => ({ a, last: lastPostedOn.get(a.platform) ?? new Date(a.connected_at).getTime() }))
    .filter(({ last }) => now - last > 10 * DAY)
    .sort((x, y) => x.last - y.last)[0];
  if (quiet && isPlatform(quiet.a.platform)) {
    const days = Math.floor((now - quiet.last) / DAY);
    out.push({
      id: `quiet-${quiet.a.platform}-${Math.floor(quiet.last / DAY)}`,
      tone: "opportunity",
      title: `${PLATFORM_META[quiet.a.platform].name} has been quiet for ${days} days`,
      body: lastPostedOn.has(quiet.a.platform) ? "Anything happen lately worth a post there?" : "It's connected but nothing has gone out yet. Your next story can include it.",
      action: { kind: "link", label: "Tell Postory what happened", href: "/app/create" },
    });
  }

  // 6. A feed that's all announcements.
  const types = rows.slice(0, 6).map((s) => String(((s.angles ?? {}) as { eventType?: unknown }).eventType ?? "")).filter(Boolean);
  if (types.length >= 4 && types.filter((t) => ANNOUNCEMENT.test(t)).length >= types.length - 1) {
    out.push({
      id: `mix-${rows[0]?.id}`,
      tone: "opportunity",
      title: "Your recent stories are mostly announcements",
      body: "A lesson, a mistake, or what building it was actually like would balance the feed, and those tend to start conversations.",
      action: { kind: "link", label: "Tell a behind-the-scenes story", href: `/app/create?text=${encodeURIComponent("Behind the scenes: ")}` },
    });
  }

  // 7. Learning from edits: patterns repeated in the owner's own changes.
  const edits = edited ?? [];
  const removedTags = edits.filter((e) => /(^|\s)#\w/.test(e.generated_content ?? "") && !/(^|\s)#\w/.test(e.content)).length;
  const removedEmoji = edits.filter((e) => /\p{Extended_Pictographic}/u.test(e.generated_content ?? "") && !/\p{Extended_Pictographic}/u.test(e.content)).length;
  const shortened = edits.filter((e) => e.generated_content && e.content.length < e.generated_content.length * 0.7).length;
  if (prefs.hashtags !== "never" && removedTags >= 3) {
    out.push({
      id: "learn-hashtags",
      tone: "learning",
      title: "You keep removing hashtags",
      body: `You took them out of ${removedTags} posts Postory wrote. Want Postory to stop adding them?`,
      action: { kind: "preference", label: "Stop using hashtags", key: "hashtags", value: "never" },
    });
  } else if (prefs.emoji !== "never" && removedEmoji >= 3) {
    out.push({
      id: "learn-emoji",
      tone: "learning",
      title: "You keep removing emoji",
      body: `You took them out of ${removedEmoji} posts Postory wrote. Want Postory to stop adding them?`,
      action: { kind: "preference", label: "Stop using emoji", key: "emoji", value: "never" },
    });
  } else if (shortened >= 3 && !(memory ?? []).some((m) => m.key === "length")) {
    out.push({
      id: "learn-length",
      tone: "learning",
      title: "You usually make Postory's drafts shorter",
      body: `You cut ${shortened} recent drafts by a third or more. Want Postory to write shorter from the start?`,
      action: { kind: "memory", label: "Write shorter", key: "length", value: "Prefers short, tight posts; cut anything that isn't doing work." },
    });
  }

  return out.filter((s) => !dismissed.has(s.id)).slice(0, 3);
}
