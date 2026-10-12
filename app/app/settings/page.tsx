import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Check, CreditCard, Mail, Minus, Workflow } from "lucide-react";
import { PageHeader } from "@/components/app/section";
import { AiPreferencesForm, BusinessForm, DeleteAccount, MemoryManager, ProductUpdatesToggle, ProfileForm, SettingsCard, VoiceForm } from "@/components/app/settings/forms";
import { ResetPasswordForm } from "@/components/onboarding/auth-forms";
import { ButtonLink } from "@/components/ui/button";
import { readPreferences } from "@/lib/ai/context";
import { aiAvailable } from "@/lib/ai/client";
import { requireAppAccess } from "@/lib/auth/access";
import { getNetworkStates } from "@/lib/data/social";
import { getEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { isPlatform, type Platform } from "@/lib/social/platforms";
import { site } from "@/lib/site";
import { safeTimeZone } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

const NAV = [
  ["profile", "Profile"],
  ["business", "Business"],
  ["voice", "Voice"],
  ["accounts", "Connections"],
  ["memory", "Business memory"],
  ["ai", "AI preferences"],
  ["permissions", "Permissions"],
  ["notifications", "Notifications"],
  ["automation", "Automation & agents"],
  ["billing", "Billing"],
  ["security", "Security"],
] as const;

export default async function SettingsPage() {
  const { user, profile } = await requireAppAccess();
  const supabase = await createClient();
  const [networks, entitlements, { data: memory }] = await Promise.all([
    getNetworkStates(user.id),
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
    { label: "Read engagement on your published posts", on: connectedCount > 0, detail: "Reactions, comments and reposts on LinkedIn and Bluesky posts Postory published — never your feed or DMs." },
    { label: "Read comments or messages from your networks", on: false, detail: "Not available through Postory's publishing provider today." },
    { label: "Run on autopilot or take instructions from AI agents", on: false, detail: "Off. See Automation & agents below." },
    { label: "Delete posts from your networks", on: false, detail: "Postory never deletes anything you've published." },
  ];

  return (
    <>
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
          <SettingsCard id="accounts" title="Connections" description="Postory publishes only to these, and only after you approve.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-ink-soft">
                {connectedCount ? `${connectedCount} connected.` : "Nothing connected yet."} Connect, reconnect and disconnect networks on the Connections page.
              </p>
              <ButtonLink href="/app/connections" size="sm" variant="secondary">
                Open Connections
              </ButtonLink>
            </div>
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
          <SettingsCard
            id="notifications"
            title="Notifications"
            description={`Postory emails ${user.email ?? "you"} from a send-only address, so replies aren't read. To reach a person, write to ${site.founder.email}.`}
          >
            <ul className="flex flex-col gap-3">
              {[
                ["A post fails to publish", "With the network's reason and a link to fix it."],
                ["A network needs reconnecting", "Scheduled posts for it are held until you do."],
                ["Your account and trial", "Sign-in codes, your welcome note, and the date your trial ends."],
              ].map(([title, body]) => (
                <li key={title} className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
                  <div>
                    <p className="text-[14px] font-medium">{title}</p>
                    <p className="text-[13px] text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 border-t border-line pt-5">
              <ProductUpdatesToggle enabled={profile.product_updates} />
            </div>
          </SettingsCard>
          <SettingsCard id="automation" title="Automation & agents" description="Optional, advanced, and never on by default.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Workflow,
                  title: "Autopilot",
                  body: "Pick networks, how often, quiet hours and topics to avoid, and Postory drafts on a rhythm. Publishing stays approval-first unless you change the rule. Replies always wait for you.",
                },
                {
                  icon: Bot,
                  title: "Agent access",
                  body: "Let tools like Claude Code or Cursor create stories and drafts in Postory for you to approve — through a scoped key you can revoke any time.",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl bg-wash p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[14px] font-semibold">
                      <f.icon className="size-4 text-ink-soft" aria-hidden />
                      {f.title}
                    </span>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">Not live yet</span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted">{f.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted">Neither is switched on for any account today, and nothing here can publish for you.</p>
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
