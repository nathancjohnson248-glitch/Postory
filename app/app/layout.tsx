import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { requireAppAccess } from "@/lib/auth/access";
import { PLANS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { formatInZone, safeTimeZone } from "@/lib/time";
import type { Platform } from "@/lib/social/platforms";

export const metadata: Metadata = { title: { default: "Home", template: "%s · Postory" }, robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, entitlements, adminRole } = await requireAppAccess();
  const supabase = await createClient();
  const [{ data: accounts }, { count: reviewCount }] = await Promise.all([
    supabase
      .from("social_accounts")
      .select("id,platform,display_name,username,status,profile_image_url")
      .eq("user_id", user.id)
      .neq("status", "disconnected")
      .order("connected_at"),
    supabase.from("story_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["awaiting_review", "draft"]),
  ]);

  const tz = safeTimeZone(profile.timezone);
  let planLabel = "No plan";
  let planTone: "ok" | "warn" = "warn";
  if (entitlements.active && entitlements.plan) {
    planTone = "ok";
    const name = PLANS[entitlements.plan].name;
    planLabel =
      entitlements.source === "development_override"
        ? `${name} · dev`
        : entitlements.trialing && entitlements.trialEndsAt
          ? `${name} trial · ends ${formatInZone(entitlements.trialEndsAt, tz, { month: "short", day: "numeric" })}`
          : name;
  } else if (adminRole) {
    planLabel = adminRole === "owner" ? "Owner" : "Admin";
    planTone = "ok";
  } else if (entitlements.reason === "trial_ended") {
    planLabel = "Trial ended";
  }

  return (
    <AppShell
      user={{ name: profile.name || profile.business_name || user.email || "You", email: user.email }}
      accounts={(accounts ?? []).map((a) => ({
        id: a.id,
        platform: a.platform as Platform,
        name: a.username ?? a.display_name ?? a.platform,
        avatarUrl: a.profile_image_url,
        status: a.status,
      }))}
      planLabel={planLabel}
      planTone={planTone}
      reviewCount={reviewCount ?? 0}
      isAdmin={Boolean(adminRole)}
    >
      {children}
    </AppShell>
  );
}
