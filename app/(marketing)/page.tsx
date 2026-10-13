import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlanCards } from "@/components/billing/plan-cards";
import { AiEngine } from "@/components/marketing/ai-engine";
import { Capabilities } from "@/components/marketing/capabilities";
import { Faq } from "@/components/marketing/faq";
import { NetworkOrbit } from "@/components/marketing/network-orbit";
import { ApprovalDemo, MemoryDemo } from "@/components/marketing/product-demos";
import { Reveal } from "@/components/marketing/reveal";
import { RiseText } from "@/components/motion/rise-text";
import { Spotlight } from "@/components/motion/spotlight";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/lib/site";


// The tab title stays the root default the founder chose.
export const metadata: Metadata = { alternates: { canonical: "/" } };

function SectionIntro({
  eyebrow,
  title,
  body,
  align = "left",
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-2xl"}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-4 font-display text-[40px] leading-[1.04] tracking-[-0.02em] text-balance sm:text-[60px] sm:leading-[1.02]">{title}</h2>
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
        <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-16">
          <div className="mx-auto max-w-5xl text-center">
            <p className="fade-rise mx-auto inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink-soft shadow-soft ring-1 ring-line">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-60 [animation-duration:2.4s]" />
                <span className="relative inline-flex size-1.5 rounded-full bg-blue-500" />
              </span>
              AI social media for businesses that ship
            </p>
            <h1 className="mt-7 font-display text-[52px] leading-[0.94] tracking-[-0.03em] text-balance sm:text-[88px] lg:text-[108px]">
              <RiseText text="Turn what happened" delay={0.08} />
              <RiseText text="into what gets posted." delay={0.32} className="block italic text-blue-600" />
            </h1>
            <p
              className="fade-rise mx-auto mt-7 max-w-2xl text-[17px] leading-relaxed text-muted text-pretty sm:text-[20px]"
              style={{ animationDelay: "0.55s" }}
            >
              Tell Postory what happened in your business. Its AI finds the story, writes platform-native posts, and prepares every version for your approval.
            </p>
            <div className="fade-rise mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center" style={{ animationDelay: "0.68s" }}>
              <Link
                href="/signup"
                className={buttonClasses({
                  size: "lg",
                  variant: "accent",
                  className: "group h-13 px-6 text-[16px]",
                })}
              >
                Start 3-day trial <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <Link
                href="#how-it-works"
                className={buttonClasses({
                  size: "lg",
                  variant: "secondary",
                  className: "h-13 px-6 text-[16px]",
                })}
              >
                Watch the AI work
              </Link>
            </div>
          </div>
        </div>
        <div id="how-it-works" className="stage-in mx-auto max-w-[1320px] scroll-mt-20 px-3 pb-16 sm:px-6 sm:pb-24" style={{ animationDelay: "0.8s" }}>
          <AiEngine />
        </div>
      </section>

      {/* Networks */}
      <section aria-label="Supported networks" className="relative overflow-hidden border-y border-line bg-surface">
        <div className="hairline-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8 sm:pb-14 sm:pt-20">
          <Reveal>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">One story · every network</p>
            <h2 className="mx-auto mt-3 max-w-xl text-center font-display text-[32px] leading-[1.05] tracking-[-0.02em] text-balance sm:text-[44px]">
              One story out to <em>every network you use.</em>
            </h2>
          </Reveal>
          <div className="mt-6 sm:mt-4">
            <NetworkOrbit />
          </div>
        </div>
      </section>

      {/* Memory */}
      <section className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 lg:gap-14 px-5 py-20 sm:py-28 sm:px-8 lg:grid-cols-2">
        <Reveal>
          <SectionIntro
            eyebrow="Grounded in your business"
            title={
              <>
                Postory writes like <em>your business.</em>
              </>
            }
            body="It knows what you do, who it's for and how you sound — because you told it. It never invents numbers, customers, quotes or features. If it doesn't know something, it asks instead of guessing."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <MemoryDemo />
        </Reveal>
      </section>

      {/* Approval */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <Reveal>
            <SectionIntro
              eyebrow="Approval first"
              title={
                <>
                  Your approval. <em>Always.</em>
                </>
              }
              body="Every post lands in review. Approve one, approve them all, or tell Postory what to change — “make the X version punchier” edits only the X version."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <ApprovalDemo />
          </Reveal>
        </div>
      </section>

      {/* Everything around the story */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <SectionIntro
              eyebrow="Around every story"
              title={
                <>
                  The same AI, <em>on every job after the post.</em>
                </>
              }
              body="Planning what's next, answering comments, making visuals, keeping your schedule and reading back what worked. All of it starts from the stories you tell Postory."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-10 sm:mt-14">
            <Capabilities />
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <SectionIntro
              align="center"
              eyebrow="Pricing"
              title={
                <>
                  Simple plans. <em>3-day trial.</em>
                </>
              }
              body="Every plan includes the approval workflow, calendar and business memory."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-10 sm:mt-14">
            <PlanCards
              renderAction={(plan) => (
                <Link
                  href={`/signup?plan=${plan}`}
                  className={buttonClasses({
                    size: "lg",
                    variant: plan === "pro" ? "accent" : "secondary",
                    className: "w-full",
                  })}
                >
                  Start 3-day trial
                </Link>
              )}
            />
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 bg-surface py-20 sm:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl gap-10 lg:gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Reveal>
            <SectionIntro
              eyebrow="Questions"
              title={
                <>
                  Good to <em>know.</em>
                </>
              }
              body={
                <>
                  Built by {site.founder.name} for founders and small teams who&apos;d rather be building. Still curious?{" "}
                  <a className="text-ink underline underline-offset-4" href={`mailto:${site.founder.email}`}>
                    Email us
                  </a>
                  .
                </>
              }
            />
          </Reveal>
          <Reveal delay={0.1}>
            <Faq />
          </Reveal>
        </div>
      </section>

      {/* Founder note */}
      <section className="mx-auto max-w-3xl px-5 pt-20 sm:px-8 sm:pt-28">
        <Reveal>
          <figure className="rounded-[28px] bg-surface p-7 shadow-soft ring-1 ring-line sm:p-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">A note from the founder</p>
            <blockquote className="mt-5 font-display text-[26px] leading-[1.3] tracking-[-0.01em] text-ink sm:text-[32px]">
              “I built Postory because the moments worth sharing kept slipping by while I was busy building. Tell it what happened, and it does the
              writing with you — never instead of you.”
            </blockquote>
            <figcaption className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
              <span className="flex items-center gap-3">
                <LogoMark variant="tile" className="size-11 rounded-xl" />
                <span>
                  <span className="block text-[15px] font-semibold">{site.founder.name}</span>
                  <span className="block text-[13px] text-muted">Founder, Postory · building in public</span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <a
                  href={site.founder.xUrl}
                  className="inline-flex h-9 items-center rounded-full bg-wash px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink hover:text-white"
                >
                  {site.founder.xHandle} on X
                </a>
                <a
                  href={`mailto:${site.founder.email}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-wash px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-ink hover:text-white"
                >
                  <Mail className="size-3.5" aria-hidden /> Email me
                </a>
              </span>
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-7xl px-5 py-20 sm:py-28 sm:px-8">
        <Reveal>
          <Spotlight className="overflow-hidden rounded-[32px] bg-ink px-6 py-16 text-center text-white sm:rounded-[36px] sm:px-16 sm:py-20">
            <div className="hairline-grid absolute inset-0 opacity-[0.07] invert" aria-hidden />
            <h2 className="relative font-display text-[42px] leading-[1] tracking-[-0.02em] text-balance sm:text-[80px] sm:leading-[0.98]">
              Get back to building. <em className="text-blue-300">We&apos;ve got the posting.</em>
            </h2>
            <p className="relative mx-auto mt-6 max-w-xl text-[17px] text-white/70">Start with a story. Your first posts are a couple of minutes away.</p>
            <Link
              href="/signup"
              className={buttonClasses({
                size: "lg",
                variant: "accent",
                className: "relative mt-10 h-13 px-7 text-[16px]",
              })}
            >
              Start 3-day trial <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Spotlight>
        </Reveal>
      </section>
    </>
  );
}
