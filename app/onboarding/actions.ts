"use server";

import { redirect } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth/session";
import { log } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { BusinessSchema, VoiceSchema, fieldErrors } from "@/lib/validation/schemas";

const STEPS = ["business", "social", "voice", "plan", "finish"] as const;
type Step = (typeof STEPS)[number];

export type StepFormState = { errors?: Record<string, string>; error?: string } | undefined;

async function setStep(userId: string, step: Step) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_step: step })
    .eq("id", userId)
    .eq("onboarding_completed", false);
  if (error) throw new Error("Could not save your progress.");
}

export async function saveBusiness(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const user = await requireUser();
  const parsed = BusinessSchema.safeParse({
    businessName: formData.get("businessName"),
    businessDescription: formData.get("businessDescription"),
    businessType: formData.get("businessType"),
    websiteUrl: formData.get("websiteUrl") ?? "",
    timezone: formData.get("timezone") ?? "UTC",
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      business_name: parsed.data.businessName,
      business_description: parsed.data.businessDescription,
      business_type: parsed.data.businessType,
      website_url: parsed.data.websiteUrl,
      timezone: parsed.data.timezone,
      onboarding_step: "social",
    })
    .eq("id", user.id)
    .eq("onboarding_completed", false);
  if (error) {
    log.error("save business failed", { operation: "onboarding.saveBusiness", userId: user.id }, error);
    return { error: "We couldn't save that. Try again." };
  }
  redirect("/onboarding");
}

export async function saveVoice(_prev: StepFormState, formData: FormData): Promise<StepFormState> {
  const user = await requireUser();
  const parsed = VoiceSchema.safeParse({
    presets: formData.getAll("presets"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: "Check your selections and try again." };

  const supabase = await createClient();
  const rows = [
    parsed.data.presets.length ? { key: "tone", value: parsed.data.presets.join(", ") } : null,
    parsed.data.notes ? { key: "notes", value: parsed.data.notes } : null,
  ].filter((r): r is { key: string; value: string } => r !== null);

  // Replace previous voice settings so the latest answer wins.
  await supabase.from("business_memory").delete().eq("user_id", user.id).eq("category", "voice").in("key", ["tone", "notes"]);
  if (rows.length) {
    const { error } = await supabase
      .from("business_memory")
      .insert(rows.map((r) => ({ ...r, user_id: user.id, category: "voice", source: "onboarding" })));
    if (error) {
      log.error("save voice failed", { operation: "onboarding.saveVoice", userId: user.id }, error);
      return { error: "We couldn't save your voice settings. Try again." };
    }
  }
  await setStep(user.id, "plan");
  redirect("/onboarding");
}

export async function goToStep(step: string) {
  const user = await requireUser();
  if (!(STEPS as readonly string[]).includes(step)) return;
  const profile = await getProfile(user.id);
  if (!profile || profile.onboarding_completed) redirect("/app");
  const target = step as Step;
  // Moving forward past the business step requires the business details.
  if (target !== "business" && !profile.business_name) {
    await setStep(user.id, "business");
  } else {
    await setStep(user.id, target);
  }
  redirect("/onboarding");
}

/**
 * Finish onboarding in a single conditional update, so a double submit or a
 * refresh can't run it twice or send the user back into onboarding.
 */
export async function completeOnboarding() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true, onboarding_step: "finish", onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .eq("onboarding_completed", false)
    .select("name,email,business_name")
    .maybeSingle();
  if (error) {
    log.error("complete onboarding failed", { operation: "onboarding.complete", userId: user.id }, error);
    throw new Error("We couldn't finish setup. Try again.");
  }
  redirect("/app");
}
