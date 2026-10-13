import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PageHero } from "@/components/marketing/page-hero";
import { ApprovalDemo, CalendarDemo, PlatformVersions, StoryInputDemo } from "@/components/marketing/product-demos";
import { Reveal } from "@/components/marketing/reveal";
import { buttonClasses } from "@/components/ui/button";
import { demoVersionsStory } from "@/lib/demo/data";

export const metadata: Metadata = {
  title: "How it works",
  description: "Something happens. Postory understands it, finds the angles, writes a native post for each network, and waits for your approval before anything goes out.",
  alternates: { canonical: "/how-it-works" },
  openGraph: { title: "How Postory works", url: "/how-it-works" },
};

const FACTS = ["Dark mode shipped today.", "It was the most-requested feature since launch.", "212 people asked for it."];
const ANGLES = [
  { name: "You asked, we built it", note: "Credit the 212 people who asked." },
  { name: "Most-requested, finally done", note: "A milestone since launch." },
  { name: "Small detail, big comfort", note: "What it changes day to day." },
];

function Step({ n, title, body, children }: { n: string; title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-t border-line py-16 sm:py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <Reveal>
          <p className="font-mono text-[12px] tracking-[0.14em] text-blue-600">{n}</p>
          <h2 className="mt-4 max-w-md font-display text-[40px] leading-[1.02] tracking-[-0.02em] text-balance sm:text-[52px]">{title}</h2>
          <div className="mt-4 max-w-md text-[16.5px] leading-relaxed text-muted text-pretty">{body}</div>
        </Reveal>
        {children ? <Reveal delay={0.08}>{children}</Reveal> : null}
      </div>
    </section>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title={
          <>
            One moment in. <em className="text-blue-600">Every network</em> out.
          </>
        }
        body="Postory is built around one loop. You tell it what happened; it does the writing; you decide what goes out."
      />

      <Step n="01" title="Something happens." body="A launch, a fix, a customer win, a bad day. Type it, paste it or dictate it — the way you'd tell a friend. No briefs, no forms.">
        <StoryInputDemo />
      </Step>

      <Step
        n="02"
        title="Postory understands it."
        body="It pulls out the facts it's allowed to use — your story plus your business memory, nothing else. Numbers stay exactly as you gave them. If something's missing or contradicts itself, it asks instead of guessing."
      >
        <div className="rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line sm:p-8">
          <p className="font-display text-[24px] leading-snug text-ink sm:text-[28px]">“{demoVersionsStory.source}”</p>
          <div className="mt-6 border-t border-line pt-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
              <LogoMark className="size-5" /> What Postory understood
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {FACTS.map((f) => (
                <li key={f} className="flex gap-2.5 text-[15px] text-ink">
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Step>

      <Step n="03" title="It finds the angles." body="The same event can be told several ways. Postory suggests the ones worth telling, and you can rewrite every draft around a different one in a tap.">
        <ul className="flex flex-col gap-3">
          {ANGLES.map((a, i) => (
            <li key={a.name} className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-4 ring-1 ${i === 0 ? "bg-blue-50/60 ring-blue-200" : "bg-surface ring-line"}`}>
              <div>
                <p className="text-[15.5px] font-semibold tracking-[-0.01em]">{a.name}</p>
                <p className="mt-0.5 text-[13.5px] text-muted">{a.note}</p>
              </div>
              {i === 0 ? <span className="rounded-full bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white">In use</span> : null}
            </li>
          ))}
        </ul>
      </Step>

      <section className="border-t border-line bg-surface py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <p className="font-mono text-[12px] tracking-[0.14em] text-blue-600">04</p>
            <h2 className="mt-4 max-w-2xl font-display text-[40px] leading-[1.02] tracking-[-0.02em] sm:text-[52px]">A native post for each network.</h2>
            <p className="mt-4 max-w-xl text-[16.5px] leading-relaxed text-muted">
              Not one paragraph reworded eight times. Each network gets its own length, rhythm and structure — and the same facts.
            </p>
          </Reveal>
          <div className="mt-12">
            <PlatformVersions />
          </div>
        </div>
      </section>

      <Step
        n="05"
        title="You approve."
        body="Everything lands in review. Edit by hand, ask for a change in plain words (“shorter”, “more like me”), regenerate, reject — or approve them all at once. Nothing is published on its own."
      >
        <ApprovalDemo />
      </Step>

      <Step n="06" title="Postory publishes." body="Publish now or pick a time in your timezone. Postory sends scheduled posts at their time, not a browser tab — and if a network fails, you're told which one and why.">
        <CalendarDemo />
      </Step>

      <section className="border-t border-line py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
          <h2 className="font-display text-[44px] leading-[1.02] tracking-[-0.02em] sm:text-[60px]">Then it remembers.</h2>
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
            Answers you save, facts you add and the voice you set are there for the next story — and you can see, edit or delete all of it.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClasses({ size: "lg", variant: "accent", className: "rounded-full px-6" })}>
              Start your 3-day trial <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/pricing" className={buttonClasses({ size: "lg", variant: "ghost", className: "rounded-full px-6" })}>
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
