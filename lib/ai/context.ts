import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BusinessContext } from "./prompts";

export function readPreferences(value: unknown): BusinessContext["preferences"] {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const emoji = v.emoji === "never" || v.emoji === "sparingly" || v.emoji === "voice" ? v.emoji : "voice";
  const hashtags = v.hashtags === "never" || v.hashtags === "sparingly" || v.hashtags === "platform" ? v.hashtags : "platform";
  return { emoji, hashtags };
}

/** Everything the model is allowed to know about the business. */
export async function loadBusinessContext(userId: string): Promise<BusinessContext> {
  const supabase = await createClient();
  const [{ data: profile }, { data: memory }, { data: approved }] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name,business_type,business_description,website_url,ai_preferences")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("business_memory")
      .select("category,key,value")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(120),
    // The owner's own voice: posts they approved, newest first, preferring ones they edited by hand.
    supabase
      .from("story_posts")
      .select("platform,content,last_edited_by")
      .eq("user_id", userId)
      .in("status", ["approved", "scheduled", "publishing", "published"])
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const voiceRows = (memory ?? []).filter((m) => m.category === "voice");
  const voice = voiceRows.length ? voiceRows.map((v) => `${v.key}: ${v.value}`).join("; ") : null;

  return {
    businessName: profile?.business_name ?? null,
    businessType: profile?.business_type ?? null,
    businessDescription: profile?.business_description ?? null,
    websiteUrl: profile?.website_url ?? null,
    voice,
    preferences: readPreferences(profile?.ai_preferences),
    memory: memory ?? [],
    voiceExamples: pickVoiceExamples(approved ?? []),
  };
}

/** Up to two examples per network, hand-edited ones first. */
function pickVoiceExamples(rows: { platform: string; content: string; last_edited_by: string | null }[]) {
  const sorted = [...rows].sort((a, b) => Number(b.last_edited_by === "user") - Number(a.last_edited_by === "user"));
  const perPlatform = new Map<string, number>();
  const picked: { platform: string; content: string }[] = [];
  for (const row of sorted) {
    const n = perPlatform.get(row.platform) ?? 0;
    if (n >= 2 || !row.content.trim()) continue;
    perPlatform.set(row.platform, n + 1);
    picked.push({ platform: row.platform, content: row.content.slice(0, 1200) });
    if (picked.length >= 8) break;
  }
  return picked;
}

/** Plain text of every fact source, used by the numeric fact check. */
export function factCorpus(ctx: BusinessContext, story: string) {
  return [story, ctx.businessName, ctx.businessDescription, ctx.websiteUrl, ...ctx.memory.map((m) => `${m.key} ${m.value}`)]
    .filter(Boolean)
    .join("\n");
}
