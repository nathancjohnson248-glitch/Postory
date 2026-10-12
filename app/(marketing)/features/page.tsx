import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Brain, CalendarDays, CheckCheck, Inbox, LineChart, PenLine, Plug, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { PlatformVersions } from "@/components/marketing/product-demos";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Features",
  description: "Stories, platform-native posts, approval, scheduling, calendar, business memory and analytics — the publishing side of your business, handled.",
  alternates: { canonical: "/features" },
};

const FEATURES = [
  { icon: PenLine, title: "Stories", body: "Capture what happened — typed, pasted or dictated. Each story keeps its posts together, so one event reads as one thing." },
  { icon: Brain, title: "Platform-native writing", body: "A distinct version for each network, written for how that network reads. Adjust any one of them in plain language without touching the rest." },
  { icon: CheckCheck, title: "Approval first", body: "Everything lands in review. Approve, edit, regenerate, reject — or approve all at once. Nothing publishes on its own." },
  { icon: CalendarDays, title: "Scheduling & calendar", body: "Schedule in your timezone, see the month at a glance, drag to move. Scheduled posts are executed by the publisher, not a browser tab." },
  { icon: ShieldCheck, title: "Facts stay facts", body: "Postory only uses your story and business memory. Numbers are kept exactly; anything it can't trace back to you is flagged before you approve." },
  { icon: Inbox, title: "Inbox", body: "A short list of conversations worth answering, with drafted replies you approve. On Pro and Max, where your networks make it available." },
  { icon: LineChart, title: "Analytics", body: "What went out, where, and which stories travelled furthest — in sentences first. Only real numbers; nothing estimated." },
  { icon: Plug, title: "Real connections", body: "Accounts connect through each network's own consent screen via our publishing provider. Postory never sees your passwords." },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="Features"
        title={<>The publishing side of your business, <em className="text-blue-600">handled.</em></>}
        body="Postory is built around one loop: tell it what happened, review what it writes, publish everywhere. Every feature serves that loop."
      />
      <section id="how-it-works" className="mx-auto grid grid-cols-1 max-w-7xl gap-4 px-5 pb-24 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <f.icon className="size-5" aria-hidden />
            </span>
            <h2 className="mt-6 text-[17px] font-semibold tracking-[-0.015em]">{f.title}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </section>
      <section className="bg-surface py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <h2 className="max-w-3xl font-display text-[44px] leading-[1.02] tracking-[-0.02em] sm:text-[56px]">
            One story. <em>Four rooms.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] text-muted">An example of how one sentence becomes four posts — same facts, different shape.</p>
          <div className="mt-12">
            <PlatformVersions />
          </div>
        </div>
      </section>
      <section id="integrations" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 sm:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {[
            ["Publishing", "Posts are published and scheduled through Postory's publishing partner, with checks before sending and idempotent requests so a retry never posts twice."],
            ["Billing", "Subscriptions run on HandyPay's hosted checkout. Card details never touch Postory."],
            ["Your data", "Stories, posts and memory live in a database where every row is locked to its owner. Delete your account and it's gone."],
          ].map(([t, b]) => (
            <div key={t}>
              <h3 className="text-[17px] font-semibold">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{b}</p>
            </div>
          ))}
        </div>
        <Link href="/signup" className={buttonClasses({ size: "lg", variant: "accent", className: "mt-14" })}>
          Start 3-day trial <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </>
  );
}
