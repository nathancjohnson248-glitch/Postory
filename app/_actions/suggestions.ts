"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserFacingError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { runAction } from "./_run";

const SuggestionId = z.string().trim().min(1).max(120).regex(/^[\w-]+$/);

/** What each learning suggestion saves. Decided here, never by the browser. */
const LEARNINGS: Record<string, { preference?: { key: "hashtags" | "emoji"; value: "never" }; memory?: { key: string; value: string } }> = {
  "learn-hashtags": { preference: { key: "hashtags", value: "never" } },
  "learn-emoji": { preference: { key: "emoji", value: "never" } },
  "learn-length": { memory: { key: "length", value: "Prefers short, tight posts; cut anything that isn't doing work." } },
};

async function preferences(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("ai_preferences").eq("id", userId).maybeSingle();
  return { supabase, prefs: (data?.ai_preferences && typeof data.ai_preferences === "object" ? data.ai_preferences : {}) as Record<string, unknown> };
}

function withDismissed(prefs: Record<string, unknown>, id: string) {
  const list = Array.isArray(prefs.dismissedSuggestions) ? (prefs.dismissedSuggestions as unknown[]).filter((x) => typeof x === "string") : [];
  return { ...prefs, dismissedSuggestions: [...new Set([id, ...list])].slice(0, 60) };
}

export async function dismissSuggestion(id: string) {
  return runAction("suggestions.dismiss", async (user) => {
    const parsed = SuggestionId.parse(id);
    const { supabase, prefs } = await preferences(user.id);
    await supabase.from("profiles").update({ ai_preferences: withDismissed(prefs, parsed) }).eq("id", user.id);
    revalidatePath("/app");
    return { dismissed: true };
  });
}

/** Accept a "Postory noticed…" suggestion: save the preference or voice note it proposes. */
export async function acceptLearning(id: string) {
  return runAction("suggestions.learn", async (user) => {
    const learning = LEARNINGS[SuggestionId.parse(id)];
    if (!learning) throw new UserFacingError("not_found", "That suggestion isn't available any more.");
    const { supabase, prefs } = await preferences(user.id);
    const next = withDismissed(learning.preference ? { ...prefs, [learning.preference.key]: learning.preference.value } : prefs, id);
    await supabase.from("profiles").update({ ai_preferences: next }).eq("id", user.id);
    if (learning.memory) {
      await supabase
        .from("business_memory")
        .upsert({ user_id: user.id, category: "voice", key: learning.memory.key, value: learning.memory.value, source: "user" }, { onConflict: "user_id,category,key" });
    }
    revalidatePath("/app", "layout");
    return { saved: true };
  });
}
