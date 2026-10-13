import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { NetworkList } from "@/components/app/network-list";
import { PlanCards } from "@/components/billing/plan-cards";
import { TrialPicker } from "@/components/billing/trial-picker";
import { StepRail } from "@/components/onboarding/step-rail";
import { FirstStoryComposer, FirstStoryResults, type FirstStory } from "@/components/onboarding/first-story";
import { AboutStep, BackButton, BusinessStep, FinishButton, NextStepButton, VoiceStep } from "@/components/onboarding/steps";
import { CheckoutReturnNotice, ConnectionReturnToast } from "@/components/onboarding/return-notices";
import { Notice } from "@/components/ui/notice";
import { getAdminRole } from "@/lib/auth/admin";
import { getProfile, requireUser } from "@/lib/auth/session";
import { billingAvailability, getSubscriptionRow } from "@/lib/billing/service";
import { PLANS } from "@/lib/billing/plans";
import { aiAvailable } from "@/lib/ai/client";
import { getEntitlements, previewGenerationsLeft } from "@/lib/entitlements";
import { isPlatform, type Platform } from "@/lib/social/platforms";
import { getNetworkStates } from "@/lib/data/social";
import { getSocialReadiness, networkAvailability } from "@/lib/social/service";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Set up Postory" };

const HEADINGS: Record<string, { title: string; body: string }> = {
  about: { title: "What are you building?", body: "Pick the closest fit. It shapes which moments Postory treats as worth posting." },
  business: { title: "Tell Postory about the business.", body: "A few lines in your own words. Postory writes from what you tell it — nothing invented." },
  voice: { title: "How should you sound?", body: "This shapes every post. You can change it any time in Settings." },
  social: { title: "Where do you post?", body: "Connect the accounts Postory should prepare posts for. Nothing is ever published without your approval." },
  story: { title: "What happened recently?", body: "Tell Postory one thing that happened in your business. It will turn it into a native post for each network." },
  storyDone: { title: "Here's your first story.", body: "One moment, written for each network. Edit or approve anything — nothing goes out without you." },
  plan: { title: "Start your 3-day trial.", body: "Pick a plan to schedule and publish. You won't be charged until the trial ends, and you can cancel any time before then." },
  planActive: { title: "You're in.", body: "Your plan is active. Open Postory and tell it what happened next." },
};

const EXAMPLES: Record<string, string[]> = {
  "Indie founder or startup": ["We shipped dark mode after 40 people asked for it.", "Our first paying customer signed up today."],
  "Creator or personal brand": ["I just passed 1,000 newsletter subscribers.", "I learned something surprising filming this week's video."],
  "Online business": ["Our autumn collection is back in stock.", "A customer sent us a photo of their order in use."],
  "Local business": ["We're open late this Friday for a tasting night.", "New pastries on the counter this morning."],
  "Agency or studio": ["We launched a new website for a local bakery.", "We wrapped a brand refresh for a client this week."],
  "Professional service": ["A client asked a question I get every week — here's my answer.", "I'm speaking at a local business meetup next month."],
};

/** The step to show, mapped from what's actually saved. */
function effectiveStep(profile: { onboarding_step: string; business_type: string | null; business_name: string | null }, activePlanOrSkip: boolean) {
  let step = profile.onboarding_step;
  if (!profile.business_type && step !== "about") step = "about";
  else if (step === "finish") step = "plan";
  else if (!profile.business_name && !["about", "business"].includes(step)) step = "business";
  if (step === "plan" && activePlanOrSkip) return "plan";
  return step;
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/auth/signout");
  if (profile.onboarding_completed) redirect("/app");

  const [params, entitlements, adminRole] = await Promise.all([searchParams, getEntitlements(user.id), getAdminRole(user)]);
  // Postory opens once a trial has started. Staff, and deployments without
  // billing, may continue without one.
  const canSkipPlan = Boolean(adminRole) || !billingAvailability().checkout;
  const step = effectiveStep(profile, entitlements.active || canSkipPlan);
  const firstStory = step === "story" ? await loadFirstStory(user.id) : null;
  const headingKey = step === "story" && firstStory ? "storyDone" : step === "plan" && entitlements.active ? "planActive" : step;
  const heading = HEADINGS[headingKey] ?? HEADINGS.about;

  return (
    <div className={step === "story" && firstStory ? "mx-auto max-w-5xl" : "mx-auto max-w-3xl"}>
      <Suspense>
        <ConnectionReturnToast />
      </Suspense>
      <div className="flex justify-center py-6">
        <StepRail current={step} />
      </div>
      <div className="mt-8 mb-10 text-center">
        {step === "business" && firstName(profile.name) ? <p className="mb-3 text-sm text-muted">Nice to meet you, {firstName(profile.name)}.</p> : null}
        <h1 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em] text-balance sm:text-[56px]">{heading.title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted text-pretty">{heading.body}</p>
      </div>

      <div>
        {step === "about" ? <AboutStep defaults={{ name: profile.name ?? "", businessType: profile.business_type ?? "" }} /> : null}

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
        {step === "story" ? (
          firstStory ? (
            <FirstStoryResults story={firstStory} authorName={profile.business_name || profile.name || "You"} previewLeft={await previewGenerationsLeft(user.id)} />
          ) : (
            <StoryStep userId={user.id} businessType={profile.business_type} />
          )
        ) : null}
        {step === "plan" ? <PlanStep userId={user.id} checkoutParam={params.checkout} eventParam={params.billing} canSkip={canSkipPlan} /> : null}
      </div>
    </div>
  );
}

async function SocialStep({ userId }: { userId: string }) {
  const [rows, readiness] = await Promise.all([getNetworkStates(userId), getSocialReadiness()]);
  const connectedCount = rows.reduce((n, r) => n + r.accounts.filter((a) => a.status === "connected").length, 0);
  return (
    <div className="mx-auto max-w-2xl">
      <NetworkList rows={rows} readiness={readiness.ready ? { ready: true } : { ready: false, message: readiness.message }} availability={await networkAvailability()} />
      <div className="mt-8 flex items-center justify-between">
        <BackButton to="voice" />
        <NextStepButton to="story" label={connectedCount ? "Continue" : "I'll connect later"} variant={connectedCount ? "primary" : "secondary"} />
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

async function PlanStep({ userId, checkoutParam, eventParam, canSkip }: { userId: string; checkoutParam?: string; eventParam?: string; canSkip: boolean }) {
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
        <div className="mt-8 flex justify-end">
          <FinishButton />
        </div>
      </div>
    );
  }

  return (
    <div>
      {eventParam ? <CheckoutReturnNotice status={eventParam} /> : null}
      {checkoutParam === "canceled" ? <Notice tone="info" title="Checkout was cancelled. No charge was made." className="mx-auto mb-6 max-w-2xl" /> : null}
      {availability.checkout ? (
        <TrialPicker returnPath="/onboarding" trialEligible={!subscription} />
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
        <BackButton to="story" />
        {canSkip ? <FinishButton label="Continue without a plan" variant="ghost" /> : null}
      </div>
    </div>
  );
}

async function StoryStep({ userId, businessType }: { userId: string; businessType: string | null }) {
  if (!aiAvailable()) {
    return (
      <div className="mx-auto max-w-xl">
        <Notice tone="info" title="Postory's writer is being switched on.">
          It isn&apos;t available on this deployment just yet. Start your trial and your first story will be the first thing you write.
        </Notice>
        <div className="mt-8 flex items-center justify-between">
          <BackButton to="social" />
          <NextStepButton to="plan" />
        </div>
      </div>
    );
  }
  const [rows, previewLeft] = await Promise.all([getNetworkStates(userId), previewGenerationsLeft(userId)]);
  const connected = [...new Set(rows.filter((r) => r.accounts.some((a) => a.status === "connected")).map((r) => r.platform))].filter(isPlatform);
  const defaults: Platform[] = connected.length ? connected : ["x", "linkedin", "instagram"];
  return <FirstStoryComposer defaultPlatforms={defaults} previewLeft={previewLeft} examples={EXAMPLES[businessType ?? ""] ?? []} />;
}

/** The story written during onboarding, if there is one yet. */
async function loadFirstStory(userId: string): Promise<FirstStory | null> {
  const supabase = await createClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id,title,summary,angles")
    .eq("user_id", userId)
    .eq("status", "ready")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!story) return null;
  const { data: posts } = await supabase
    .from("story_posts")
    .select("id,platform,content,status,version,angle")
    .eq("story_id", story.id)
    .order("created_at", { ascending: true });
  if (!posts?.length) return null;
  const angles = (story.angles as { angles?: unknown } | null)?.angles;
  return {
    id: story.id,
    title: story.title,
    summary: story.summary,
    angles: Array.isArray(angles) ? angles.filter((a): a is string => typeof a === "string") : [],
    posts: posts.filter((p) => isPlatform(p.platform)).map((p) => ({ ...p, platform: p.platform as Platform })),
  };
}
