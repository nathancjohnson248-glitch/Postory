import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { NetworkList } from "@/components/app/network-list";
import { PlanCards } from "@/components/billing/plan-cards";
import { PlanPicker } from "@/components/billing/plan-picker";
import { StepRail } from "@/components/onboarding/step-rail";
import { BackButton, BusinessStep, FinishButton, NextStepButton, VoiceStep } from "@/components/onboarding/steps";
import { CheckoutReturnNotice, ConnectionReturnToast } from "@/components/onboarding/return-notices";
import { Notice } from "@/components/ui/notice";
import { getProfile, requireUser } from "@/lib/auth/session";
import { billingAvailability, getSubscriptionRow } from "@/lib/billing/service";
import { PLANS } from "@/lib/billing/plans";
import { getEntitlements } from "@/lib/entitlements";
import { getNetworkStates } from "@/lib/data/social";
import { getSocialReadiness } from "@/lib/social/service";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up Postory" };

const HEADINGS: Record<string, { title: string; body: string }> = {
  business: { title: "Tell us about the business.", body: "Postory writes from what you tell it — nothing invented. Start with the basics." },
  social: { title: "Connect your social accounts.", body: "Postory publishes only to accounts you connect, and only after you approve each post." },
  voice: { title: "How should Postory sound?", body: "Optional. This shapes every post. You can change it any time in Settings." },
  plan: { title: "Pick a plan.", body: "Every plan includes the approval workflow, calendar and business memory. Start with a 3-day trial." },
  finish: { title: "You're set.", body: "Tell Postory what's happening in your business and it will turn it into posts for your review." },
};

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/auth/signout");
  if (profile.onboarding_completed) redirect("/app");

  const params = await searchParams;
  const step = profile.onboarding_step;
  const heading = HEADINGS[step] ?? HEADINGS.business;

  return (
    <div className="mx-auto max-w-3xl">
      <Suspense>
        <ConnectionReturnToast />
      </Suspense>
      <div className="flex justify-center py-6">
        <StepRail current={step} />
      </div>
      <div className="mt-8 mb-10 text-center">
        {step === "business" && firstName(profile.name) ? (
          <p className="mb-3 text-sm text-muted">Hi {firstName(profile.name)} — let&apos;s get your workspace ready.</p>
        ) : null}
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em] text-balance sm:text-[56px]">{heading.title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted text-pretty">{heading.body}</p>
      </div>

      <div>
        {step === "business" ? (
          <div className="mx-auto max-w-xl rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:p-8">
            <BusinessStep
              defaults={{
                businessName: profile.business_name ?? "",
                businessDescription: profile.business_description ?? "",
                businessType: profile.business_type ?? "",
                websiteUrl: profile.website_url ?? "",
              }}
            />
          </div>
        ) : null}

        {step === "social" ? <SocialStep userId={user.id} /> : null}
        {step === "voice" ? <VoiceStepLoader userId={user.id} /> : null}
        {step === "plan" ? <PlanStep userId={user.id} checkoutParam={params.checkout} eventParam={params.billing} /> : null}
        {step === "finish" ? <FinishStep userId={user.id} /> : null}
      </div>
    </div>
  );
}

async function SocialStep({ userId }: { userId: string }) {
  const [rows, readiness] = await Promise.all([getNetworkStates(userId), getSocialReadiness(userId)]);
  const connectedCount = rows.reduce((n, r) => n + r.accounts.filter((a) => a.status === "connected").length, 0);
  return (
    <div className="mx-auto max-w-2xl">
      <NetworkList rows={rows} readiness={readiness.ready ? { ready: true } : { ready: false, message: readiness.message }} returnPath="/onboarding" />
      <div className="mt-8 flex items-center justify-between">
        <BackButton to="business" />
        <NextStepButton to="voice" label={connectedCount ? "Continue" : "Skip for now"} variant={connectedCount ? "primary" : "secondary"} />
      </div>
    </div>
  );
}

async function VoiceStepLoader({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("business_memory").select("key,value").eq("user_id", userId).eq("category", "voice");
  const tone = data?.find((d) => d.key === "tone")?.value ?? "";
  const notes = data?.find((d) => d.key === "notes")?.value ?? "";
  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line sm:p-8">
      <VoiceStep defaults={{ presets: tone ? tone.split(", ") : [], notes }} />
    </div>
  );
}

async function PlanStep({ userId, checkoutParam, eventParam }: { userId: string; checkoutParam?: string; eventParam?: string }) {
  const [entitlements, subscription] = await Promise.all([getEntitlements(userId), getSubscriptionRow(userId)]);
  const availability = billingAvailability();

  if (entitlements.active && entitlements.plan) {
    const plan = PLANS[entitlements.plan];
    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-start gap-4 rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold">
              {entitlements.source === "development_override" ? `${plan.name} (development override)` : `You're on ${plan.name}`}
              {entitlements.trialing ? " — trial" : ""}
            </p>
            <p className="mt-1 text-sm text-muted">
              {entitlements.trialing && entitlements.trialEndsAt
                ? `Your trial runs until ${entitlements.trialEndsAt.toLocaleDateString(undefined, { month: "long", day: "numeric" })}.`
                : entitlements.source === "development_override"
                  ? "Granted by POSTORY_DEV_PLAN in local development. No billing is involved."
                  : "Your subscription is active."}
            </p>
          </div>
        </div>
        <div className="mt-8 flex items-center justify-between">
          <BackButton to="voice" />
          <NextStepButton to="finish" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {eventParam ? <CheckoutReturnNotice status={eventParam} /> : null}
      {checkoutParam === "canceled" ? <Notice tone="info" title="Checkout was cancelled. No charge was made." className="mx-auto mb-6 max-w-2xl" /> : null}
      {availability.checkout ? (
        <PlanPicker returnPath="/onboarding" trialEligible={!subscription?.trial_ends_at} />
      ) : (
        <>
          <Notice tone="info" title="Billing isn't live yet" className="mx-auto mb-8 max-w-2xl">
            Postory&apos;s HandyPay checkout is still being connected, so plans can&apos;t be purchased right now. Finish setup and choose a plan from
            Billing once it&apos;s available — nothing will be charged until you do.
          </Notice>
          <PlanCards
            renderAction={(plan) => (
              <div
                className={`flex h-12 w-full items-center justify-center rounded-[14px] text-sm ${plan === "pro" ? "bg-white/10 text-white/70" : "bg-wash text-muted"}`}
              >
                Available soon
              </div>
            )}
          />
        </>
      )}
      <div className="mx-auto mt-10 flex max-w-2xl items-center justify-between">
        <BackButton to="voice" />
        <NextStepButton to="finish" label="Continue without a plan" variant="ghost" />
      </div>
    </div>
  );
}

async function FinishStep({ userId }: { userId: string }) {
  const [rows, entitlements] = await Promise.all([getNetworkStates(userId), getEntitlements(userId)]);
  const connected = rows.flatMap((r) => r.accounts.filter((a) => a.status === "connected").map(() => r.platform));
  return (
    <div className="mx-auto max-w-xl">
      <ul className="divide-y divide-line rounded-3xl bg-surface shadow-soft ring-1 ring-line">
        <li className="flex items-center justify-between px-6 py-4 text-sm">
          <span className="text-muted">Business profile</span>
          <span className="font-medium">Saved</span>
        </li>
        <li className="flex items-center justify-between px-6 py-4 text-sm">
          <span className="text-muted">Connected accounts</span>
          <span className="font-medium">{connected.length ? connected.length : "None yet"}</span>
        </li>
        <li className="flex items-center justify-between px-6 py-4 text-sm">
          <span className="text-muted">Plan</span>
          <span className="font-medium">{entitlements.active && entitlements.plan ? PLANS[entitlements.plan].name : "Not chosen yet"}</span>
        </li>
      </ul>
      {!entitlements.active ? (
        <p className="mt-4 text-center text-sm text-muted">You can explore Postory now. Generating and publishing posts needs a plan.</p>
      ) : null}
      <div className="mt-8 flex items-center justify-between">
        <BackButton to="plan" />
        <FinishButton />
      </div>
    </div>
  );
}
