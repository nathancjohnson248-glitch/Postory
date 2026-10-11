import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCheck, MessageSquareText, PenLine } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PlanCards } from "@/components/billing/plan-cards";
import { Faq } from "@/components/marketing/faq";
import { AnalyticsDemo, ApprovalDemo, CalendarDemo, HeroProduct, MemoryDemo, PlatformVersions } from "@/components/marketing/product-demos";
import { Reveal } from "@/components/marketing/reveal";
import { buttonClasses } from "@/components/ui/button";
import { PLATFORMS, PLATFORM_META } from "@/lib/social/platforms";
import { site } from "@/lib/site";

function SectionIntro({ eyebrow, title, body, align = "left" }: { eyebrow: string; title: React.ReactNode; body?: React.ReactNode; align?: "left" | "center" }) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-4 font-display text-[44px] leading-[1.02] tracking-[-0.02em] text-balance sm:text-[60px]">{title}</h2>
      {body ? <p className="mt-5 text-[17px] leading-relaxed text-muted text-pretty">{body}</p> : null}
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hairline-grid absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" aria-hidden />
        <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
          <Reveal className="mx-auto max-w-5xl text-center">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft shadow-soft ring-1 ring-line">
              <span className="size-1.5 rounded-full bg-blue-500" aria-hidden />
              Social publishing for businesses that ship
            </p>
            <h1 className="mt-8 font-display text-[58px] leading-[0.92] tracking-[-0.03em] text-balance sm:text-[96px] lg:text-[124px]">
              Your business doesn&apos;t stop.
              <span className="block italic text-blue-600">Neither should your social.</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-[18px] leading-relaxed text-muted text-pretty sm:text-[20px]">
              Tell Postory what happened. It turns the moment into platform-native posts, waits for your approval, and keeps every network moving.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className={buttonClasses({ size: "lg", variant: "accent", className: "h-13 px-6 text-[16px]" })}>
                Start 3-day trial <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="#product" className={buttonClasses({ size: "lg", variant: "secondary", className: "h-13 px-6 text-[16px]" })}>
                View product
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="mx-auto mt-16 max-w-6xl" >
            <div id="product" className="scroll-mt-24">
              <HeroProduct />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Networks */}
      <section aria-label="Supported networks" className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:justify-between">
          <p className="text-[14px] text-muted">One story out to every network you use</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-4">
            {PLATFORMS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-[14px] font-medium text-ink-soft">
                <PlatformIcon platform={p} className="size-4" />
                {PLATFORM_META[p].name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal>
          <SectionIntro eyebrow="How it works" title={<>Tell it once. <em>Show up everywhere.</em></>} body="Postory sits between what's happening in your business and the networks you publish to. You stay in charge of every word that goes out." />
        </Reveal>
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {[
            { icon: PenLine, step: "01", title: "Tell Postory what happened", body: "Type it, paste it, or say it out loud. A launch, a milestone, a hire, a promotion — in your own words." },
            { icon: MessageSquareText, step: "02", title: "It writes for every network", body: "Short and sharp for X. Considered for LinkedIn. Visual-first for Instagram. Same facts, native voice." },
            { icon: CheckCheck, step: "03", title: "You approve. It publishes.", body: "Edit anything, approve what you like, then publish now or schedule it. Nothing goes out without you." },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 0.08}>
              <div className="h-full rounded-3xl bg-surface p-7 shadow-soft ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                    <s.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-[12px] text-faint">{s.step}</span>
                </div>
                <h3 className="mt-8 text-[20px] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Story → posts */}
      <section className="bg-surface py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <SectionIntro
              eyebrow="One story, many posts"
              title={<>Same facts. <em>Different rooms.</em></>}
              body="Each network has its own rhythm. Postory adapts the structure, length and tone for each one — it doesn't just reword the same paragraph."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-14">
            <PlatformVersions />
          </Reveal>
        </div>
      </section>

      {/* Approval */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-28 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <SectionIntro
            eyebrow="Approval first"
            title={<>Nothing goes out <em>without you.</em></>}
            body="Every post lands in review. Approve one, approve them all, or tell Postory what to change — “make the X version punchier” edits only the X version."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <ApprovalDemo />
        </Reveal>
      </section>

      {/* Calendar */}
      <section className="bg-surface py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <Reveal>
            <SectionIntro
              eyebrow="Calendar"
              title={<>Your week, <em>at a glance.</em></>}
              body="See what's going out and when, in your timezone. Drag a post to another day to move it. Everything scheduled is executed by the publisher, not left to chance."
            />
            <ul className="mt-8 flex flex-col gap-3 text-[15px] text-ink-soft">
              {["Month and agenda views", "Drag to reschedule", "Approved posts ready to plan"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <CalendarDays className="size-4 text-blue-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <CalendarDemo />
          </Reveal>
        </div>
      </section>

      {/* Memory */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-28 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <SectionIntro
            eyebrow="Business memory"
            title={<>It remembers your business. <em>It never makes things up.</em></>}
            body="Postory writes from what you tell it and what it has saved about your business — nothing else. Numbers stay exactly as you gave them. If it doesn't know something, it asks."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <MemoryDemo />
        </Reveal>
      </section>

      {/* Analytics */}
      <section className="bg-surface py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
          <Reveal className="order-2 lg:order-1">
            <AnalyticsDemo />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <SectionIntro
              eyebrow="Analytics"
              title={<>Know what <em>worked.</em></>}
              body="Plain sentences first, charts second. What went out, where it went, which stories travelled furthest — no wall of meaningless graphs."
            />
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-28 sm:px-8">
        <Reveal>
          <SectionIntro align="center" eyebrow="Pricing" title={<>Simple plans. <em>3-day trial.</em></>} body="Every plan includes the approval workflow, calendar and business memory." />
        </Reveal>
        <Reveal delay={0.1} className="mt-14">
          <PlanCards
            renderAction={(plan) => (
              <Link href={`/signup?plan=${plan}`} className={buttonClasses({ size: "lg", variant: plan === "pro" ? "accent" : "secondary", className: "w-full" })}>
                Start 3-day trial
              </Link>
            )}
          />
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="about" className="bg-surface py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <SectionIntro eyebrow="Questions" title={<>Good to <em>know.</em></>} body={<>Built by {site.founder.name} for founders and small teams who&apos;d rather be building. Still curious? <a className="text-ink underline underline-offset-4" href={`mailto:${site.founder.email}`}>Email us</a>.</>} />
          </Reveal>
          <Reveal delay={0.1}>
            <Faq />
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-5 py-28 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-20 text-center text-white sm:px-16">
            <div className="hairline-grid absolute inset-0 opacity-[0.07] invert" aria-hidden />
            <h2 className="relative font-display text-[48px] leading-[0.98] tracking-[-0.02em] text-balance sm:text-[80px]">
              Get back to building. <em className="text-blue-300">We&apos;ve got the posting.</em>
            </h2>
            <p className="relative mx-auto mt-6 max-w-xl text-[17px] text-white/70">Start with a story. Your first posts are a couple of minutes away.</p>
            <Link href="/signup" className={buttonClasses({ size: "lg", variant: "accent", className: "relative mt-10 h-13 px-7 text-[16px]" })}>
              Start 3-day trial <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
