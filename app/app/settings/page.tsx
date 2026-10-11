import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Check, CreditCard, Minus } from "lucide-react";
import { NetworkList } from "@/components/app/network-list";
import { PageHeader } from "@/components/app/section";
import { AiPreferencesForm, BusinessForm, DeleteAccount, MemoryManager, ProfileForm, SettingsCard, VoiceForm } from "@/components/app/settings/forms";
import { ConnectionReturnToast } from "@/components/onboarding/return-notices";
import { ResetPasswordForm } from "@/components/onboarding/auth-forms";
import { ButtonLink } from "@/components/ui/button";
import { readPreferences } from "@/lib/ai/context";
import { aiAvailable } from "@/lib/ai/client";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getNetworkStates } from "@/lib/data/social";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/billing/plans";
import { getSocialReadiness } from "@/lib/social/service";
import { createClient } from "@/lib/supabase/server";
import { isPlatform, type Platform } from "@/lib/social/platforms";
import { safeTimeZone } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

const NAV = [
  ["profile", "Profile"],
  ["business", "Business"],
  ["voice", "Voice"],
  ["accounts", "Connected accounts"],
  ["memory", "Business memory"],
  ["ai", "AI preferences"],
  ["permissions", "Permissions"],
  ["billing", "Billing"],
  ["security", "Security"],
] as const;

export default async function SettingsPage() {
  const { user, profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const [networks, readiness, entitlements, { data: memory }] = await Promise.all([
    getNetworkStates(user.id),
    getSocialReadiness(user.id),
    getEntitlements(user.id),
    supabase.from("business_memory").select("id,category,key,value,source").eq("user_id", user.id).order("category").order("updated_at", { ascending: false }),
  ]);
  const voice = (memory ?? []).filter((m) => m.category === "voice");
  const tone = voice.find((v) => v.key === "tone")?.value ?? "";
  const prefs = readPreferences(profile.ai_preferences);
  const rawDefaults = (profile.ai_preferences as { defaultPlatforms?: unknown } | null)?.defaultPlatforms;
  const defaultPlatforms = Array.isArray(rawDefaults) ? (rawDefaults.filter(isPlatform) as Platform[]) : [];
  const connectedCount = networks.reduce((n, r) => n + r.accounts.filter((a) => a.status === "connected").length, 0);

  const permissions = [
    { label: "Read and write your stories and posts", on: true, detail: "So Postory can draft, store and organise your content." },
    { label: "Publish to your connected accounts", on: connectedCount > 0, detail: connectedCount ? `${connectedCount} connected. Only after you approve a post, and only when you press Publish or a schedule you set fires.` : "No accounts connected." },
    { label: "Use your business memory when writing", on: true, detail: "Your profile, voice and saved facts — nothing else." },
    { label: "Send your story text to the AI model", on: aiAvailable(), detail: "Only when you generate, edit with AI, or ask the assistant." },
    { label: "Read comments, messages or analytics from your networks", on: false, detail: "Not available through Postory's publishing provider today." },
    { label: "Delete posts from your networks", on: false, detail: "Postory never deletes anything you've published." },
  ];

  return (
    <>
      <Suspense>
        <ConnectionReturnToast />
      </Suspense>
      <PageHeader title="Settings" description="Your profile, your business, and what Postory can do on your behalf." />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="sticky top-10 flex flex-col gap-0.5">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-[13.5px] text-muted transition-colors hover:bg-wash hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">
          <SettingsCard id="profile" title="Profile">
            <ProfileForm name={profile.name ?? ""} email={user.email ?? profile.email ?? ""} timezone={safeTimeZone(profile.timezone)} />
          </SettingsCard>
          <SettingsCard id="business" title="Business" description="What Postory knows about the business. Used in every post.">
            <BusinessForm
              businessName={profile.business_name ?? ""}
              businessDescription={profile.business_description ?? ""}
              businessType={profile.business_type ?? ""}
              websiteUrl={profile.website_url ?? ""}
            />
          </SettingsCard>
          <SettingsCard id="voice" title="Voice" description="How Postory should sound.">
            <VoiceForm presets={tone ? tone.split(", ") : []} notes={voice.find((v) => v.key === "notes")?.value ?? ""} />
          </SettingsCard>
          <SettingsCard id="accounts" title="Connected accounts" description="Postory publishes only to these, and only after you approve.">
            <NetworkList rows={networks} readiness={readiness.ready ? { ready: true } : { ready: false, message: readiness.message }} returnPath="/app/settings" />
          </SettingsCard>
          <SettingsCard id="memory" title="Business memory" description="Facts Postory may use. If it isn't here or in your story, Postory won't claim it.">
            <MemoryManager rows={(memory ?? []).map((m) => ({ id: m.id, category: m.category, key: m.key, value: m.value, source: m.source }))} />
          </SettingsCard>
          <SettingsCard id="ai" title="AI preferences">
            <AiPreferencesForm defaultPlatforms={defaultPlatforms} emoji={prefs.emoji} hashtags={prefs.hashtags} />
          </SettingsCard>
          <SettingsCard id="permissions" title="Permissions" description="What Postory can and can't access.">
            <ul className="flex flex-col gap-4">
              {permissions.map((p) => (
                <li key={p.label} className="flex items-start gap-3">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${p.on ? "bg-success-wash text-success" : "bg-wash text-faint"}`}>
                    {p.on ? <Check className="size-3" aria-label="Allowed" /> : <Minus className="size-3" aria-label="Not allowed" />}
                  </span>
                  <div>
                    <p className="text-[14px] font-medium">{p.label}</p>
                    <p className="text-[13px] text-muted">{p.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </SettingsCard>
          <SettingsCard id="billing" title="Billing">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <p className="text-[14px] text-muted">
                {entitlements.active && entitlements.plan ? `You're on ${PLANS[entitlements.plan].name}${entitlements.trialing ? " (trial)" : ""}.` : "You don't have a plan yet."}
              </p>
              <ButtonLink href="/app/billing" variant="secondary" icon={<CreditCard className="size-4" />}>
                Manage billing
              </ButtonLink>
            </div>
          </SettingsCard>
          <SettingsCard id="security" title="Security">
            <div className="flex flex-col gap-8">
              <div className="max-w-sm">
                <p className="mb-3 text-[14px] font-medium">Change password</p>
                <ResetPasswordForm />
              </div>
              <div className="flex flex-col items-start gap-3 border-t border-line pt-6">
                <p className="text-[14px] font-medium">Sign out</p>
                <form action="/auth/signout" method="post">
                  <button className="text-[14px] font-medium text-blue-600 hover:underline">Sign out of Postory</button>
                </form>
              </div>
              <div className="flex flex-col items-start gap-3 border-t border-line pt-6">
                <p className="text-[14px] font-medium">Delete account</p>
                <p className="max-w-lg text-[13.5px] text-muted">
                  Ending a trial or subscription never deletes your content. Deleting your account does — permanently. Read the{" "}
                  <Link href="/privacy" className="text-ink underline-offset-2 hover:underline">
                    privacy policy
                  </Link>{" "}
                  for what we keep and for how long.
                </p>
                <DeleteAccount />
              </div>
            </div>
          </SettingsCard>
        </div>
      </div>
    </>
  );
}
