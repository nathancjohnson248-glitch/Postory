import type { Metadata } from "next";
import { PageHeader } from "@/components/app/section";
import { CreateWorkspace } from "@/components/app/create/create-workspace";
import type { GenerationAvailability } from "@/components/app/create/composer";
import { aiAvailable } from "@/lib/ai/client";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getEntitlements, getUsageSummary } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";
import { isPlatform, type Platform } from "@/lib/social/platforms";
import { safeTimeZone } from "@/lib/time";

export const metadata: Metadata = { title: "Create" };
export const maxDuration = 60;

export default async function CreatePage({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const { user, profile } = await requireOnboardedUser();
  const { text } = await searchParams;
  const supabase = await createClient();
  const [entitlements, { data: accounts }] = await Promise.all([
    getEntitlements(user.id),
    supabase.from("social_accounts").select("platform,username,display_name").eq("user_id", user.id).eq("status", "connected"),
  ]);
  const usage = entitlements.active ? await getUsageSummary(user.id, entitlements) : [];
  const gen = usage.find((u) => u.metric === "ai_generation");
  const prefs = profile.ai_preferences as { defaultPlatforms?: unknown } | null;
  const defaultPlatforms = Array.isArray(prefs?.defaultPlatforms) ? (prefs.defaultPlatforms.filter(isPlatform) as Platform[]) : [];

  let availability: GenerationAvailability;
  let assistant: { enabled: boolean; reason?: string } = { enabled: true };
  if (!aiAvailable()) {
    availability = { ok: false, reason: "AI writing isn't switched on, so you'll write each network's version yourself." };
    assistant = { enabled: false, reason: "The assistant isn't configured on this deployment yet." };
  } else if (!entitlements.active) {
    availability = {
      ok: false,
      reason: entitlements.reason === "trial_ended" ? "Your trial has ended." : "Generating posts needs a plan.",
      action: { label: "Choose a plan", href: "/app/billing" },
    };
    assistant = { enabled: false, reason: "The assistant needs an active plan." };
  } else if (gen && gen.used >= gen.limit) {
    availability = { ok: false, reason: `You've used all ${gen.limit} generations this period.`, action: { label: "Upgrade", href: "/app/billing" } };
  } else {
    availability = { ok: true, remaining: Math.max(0, (gen?.limit ?? 0) - (gen?.used ?? 0)), limit: gen?.limit ?? 0 };
  }

  return (
    <>
      <PageHeader title="What happened?" description="A launch, a milestone, a new hire, something you learned. Tell it plainly — Postory turns it into posts for each network and waits for your review." />
      <CreateWorkspace
        initialText={typeof text === "string" ? text.slice(0, 8000) : ""}
        connected={(accounts ?? []).map((a) => ({ platform: a.platform as Platform, name: a.username ?? a.display_name ?? a.platform }))}
        defaultPlatforms={defaultPlatforms}
        availability={availability}
        assistant={assistant}
        timezone={safeTimeZone(profile.timezone)}
      />
    </>
  );
}
