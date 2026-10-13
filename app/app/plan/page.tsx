import type { Metadata } from "next";
import { Planner } from "@/components/app/plan/planner";
import { PageHeader } from "@/components/app/section";
import { aiAvailable } from "@/lib/ai/client";
import { ValidatedPlan } from "@/lib/ai/types";
import { requireAppAccess } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeDay, safeTimeZone } from "@/lib/time";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const { user, profile, entitlements } = await requireAppAccess();
  const supabase = await createClient();
  const { data: latest } = await supabase.from("content_plans").select("plan,horizon_days,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const plan = latest ? ValidatedPlan.safeParse(latest.plan) : null;
  const horizon = entitlements.features.advancedPlanning ? 14 : 7;

  return (
    <>
      <PageHeader
        eyebrow="Plan"
        title="What's worth posting next"
        description={`Postory looks at your recent stories, business memory and schedule, and suggests the next ${horizon} days of posts. It never invents events: where it needs a real detail, it asks you.`}
      />
      <Planner
        initial={plan?.success ? plan.data : null}
        generatedAt={latest ? formatRelativeDay(latest.created_at, safeTimeZone(profile.timezone)) : null}
        horizon={horizon}
        enabled={aiAvailable() && entitlements.active}
      />
    </>
  );
}
