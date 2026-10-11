import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PLATFORM_META, type Platform } from "@/lib/social/platforms";
import { addDaysToKey, dateKey, formatInZone, zonedParts, zonedToUtc } from "@/lib/time";

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;

/**
 * Publishing analytics computed from Postory's own records — every number
 * here is something Postory did for this user. Engagement metrics come only
 * from analytics_snapshots, which is filled solely from provider data.
 */
export async function getAnalytics(userId: string, timezone: string, rangeDays: 30 | 90) {
  const supabase = await createClient();
  const now = new Date();
  const today = dateKey(now, timezone);
  const rangeStart = zonedToUtc(addDaysToKey(today, -(rangeDays - 1)), "00:00", timezone);

  // Weekly series: the last 8 weeks, Monday-start, in the user's timezone.
  const weekday = (zonedParts(now, timezone).weekday + 6) % 7;
  const thisMonday = addDaysToKey(today, -weekday);
  const weekKeys = Array.from({ length: 8 }, (_, i) => addDaysToKey(thisMonday, (i - 7) * 7));
  const seriesStart = zonedToUtc(weekKeys[0], "00:00", timezone);
  const since = new Date(Math.min(rangeStart.getTime(), seriesStart.getTime())).toISOString();

  const [{ data: published }, { data: created }, { count: storiesCount }, { data: snapshots }] = await Promise.all([
    supabase
      .from("story_posts")
      .select("platform,published_at,story_id,angle,stories(title)")
      .eq("user_id", userId)
      .eq("status", "published")
      .gte("published_at", since)
      .order("published_at"),
    supabase.from("story_posts").select("status,created_at").eq("user_id", userId).gte("created_at", rangeStart.toISOString()),
    supabase.from("stories").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", rangeStart.toISOString()),
    supabase
      .from("analytics_snapshots")
      .select("platform,metric_date,followers,impressions,engagements")
      .eq("user_id", userId)
      .gte("metric_date", addDaysToKey(today, -rangeDays))
      .order("metric_date"),
  ]);

  const all = (published ?? []) as unknown as { platform: string; published_at: string; story_id: string; angle: string | null; stories: { title: string } | null }[];
  const inRange = all.filter((p) => new Date(p.published_at) >= rangeStart);

  const weekly = weekKeys.map((key, i) => {
    const start = zonedToUtc(key, "00:00", timezone).getTime();
    const end = i < weekKeys.length - 1 ? zonedToUtc(weekKeys[i + 1], "00:00", timezone).getTime() : Infinity;
    return {
      label: formatInZone(new Date(`${key}T12:00:00Z`), "UTC", { month: "short", day: "numeric" }),
      value: all.filter((p) => {
        const t = new Date(p.published_at).getTime();
        return t >= start && t < end;
      }).length,
    };
  });

  const byNetwork = Object.entries(
    inRange.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.platform]: (acc[p.platform] ?? 0) + 1 }), {}),
  )
    .map(([platform, count]) => ({ platform: platform as Platform, count }))
    .sort((a, b) => b.count - a.count);

  const storyReach = Object.values(
    inRange.reduce<Record<string, { title: string; storyId: string; networks: Set<string> }>>((acc, p) => {
      const entry = acc[p.story_id] ?? { title: p.stories?.title ?? "Untitled story", storyId: p.story_id, networks: new Set() };
      entry.networks.add(p.platform);
      acc[p.story_id] = entry;
      return acc;
    }, {}),
  ).sort((a, b) => b.networks.size - a.networks.size);

  const createdRows = created ?? [];
  const accepted = createdRows.filter((p) => ["approved", "scheduled", "publishing", "published"].includes(p.status)).length;
  const rejected = createdRows.filter((p) => p.status === "rejected").length;
  const reviewed = accepted + rejected;

  const weekdayCounts = Array.from({ length: 7 }, () => 0);
  const hourBuckets = { Morning: 0, Midday: 0, Afternoon: 0, Evening: 0 } as Record<string, number>;
  for (const p of inRange) {
    const parts = zonedParts(new Date(p.published_at), timezone);
    weekdayCounts[(parts.weekday + 6) % 7] += 1;
    const h = parts.hour;
    hourBuckets[h < 11 ? "Morning" : h < 14 ? "Midday" : h < 18 ? "Afternoon" : "Evening"] += 1;
  }
  const byAngle = Object.entries(
    inRange.reduce<Record<string, number>>((acc, p) => (p.angle ? { ...acc, [p.angle]: (acc[p.angle] ?? 0) + 1 } : acc), {}),
  )
    .map(([angle, count]) => ({ angle, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const headlines: string[] = [];
  if (inRange.length) {
    headlines.push(`You published ${inRange.length} ${inRange.length === 1 ? "post" : "posts"} in the last ${rangeDays} days.`);
    if (byNetwork[0]) headlines.push(`${PLATFORM_META[byNetwork[0].platform].name} was your most active network (${byNetwork[0].count}).`);
    if (storyReach[0] && storyReach[0].networks.size > 1) headlines.push(`“${storyReach[0].title}” reached the most networks (${storyReach[0].networks.size}).`);
  }
  if (reviewed >= 5) headlines.push(`You approved ${Math.round((accepted / reviewed) * 100)}% of the posts Postory wrote.`);

  return {
    rangeDays,
    totals: { published: inRange.length, stories: storiesCount ?? 0, accepted, rejected, reviewed },
    weekly,
    byNetwork,
    topStories: storyReach.slice(0, 5).map((s) => ({ title: s.title, storyId: s.storyId, networks: [...s.networks] as Platform[] })),
    advanced: {
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({ label, value: weekdayCounts[i] })),
      dayparts: Object.entries(hourBuckets).map(([label, value]) => ({ label, value })),
      byAngle,
    },
    engagement: snapshots ?? [],
    headlines,
  };
}
