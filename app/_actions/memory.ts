"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MemorySchema, idSchema } from "@/lib/validation/schemas";
import { UserFacingError } from "@/lib/errors";
import { runAction } from "./_run";

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "fact";
}

export async function addMemory(input: { category: string; key: string; value: string; source?: "user" | "story" }) {
  return runAction("memory.add", async (user) => {
    const data = MemorySchema.parse(input);
    const supabase = await createClient();
    const key = data.category === "facts" || data.category === "milestone" ? `${slug(data.key)}-${Date.now().toString(36)}` : data.key;
    const { error } = await supabase.from("business_memory").upsert(
      { user_id: user.id, category: data.category, key, value: data.value, source: input.source === "story" ? "story" : "user" },
      { onConflict: "user_id,category,key" },
    );
    if (error) throw error;
    revalidatePath("/app/settings");
    return { saved: true };
  });
}

export async function updateMemory(id: string, value: string) {
  return runAction("memory.update", async (user) => {
    const clean = value.trim();
    if (!clean || clean.length > 4000) throw new UserFacingError("invalid", "Keep it between 1 and 4,000 characters.");
    const supabase = await createClient();
    await supabase.from("business_memory").update({ value: clean, source: "user", confidence: 1 }).eq("id", idSchema.parse(id)).eq("user_id", user.id);
    revalidatePath("/app/settings");
    return { saved: true };
  });
}

export async function deleteMemory(id: string) {
  return runAction("memory.delete", async (user) => {
    const supabase = await createClient();
    await supabase.from("business_memory").delete().eq("id", idSchema.parse(id)).eq("user_id", user.id);
    revalidatePath("/app/settings");
    return { deleted: true };
  });
}
