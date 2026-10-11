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
  const [{ data: profile }, { data: memory }] = await Promise.all([
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
  };
}

/** Plain text of every fact source, used by the numeric fact check. */
export function factCorpus(ctx: BusinessContext, story: string) {
  return [story, ctx.businessName, ctx.businessDescription, ctx.websiteUrl, ...ctx.memory.map((m) => `${m.key} ${m.value}`)]
    .filter(Boolean)
    .join("\n");
}
