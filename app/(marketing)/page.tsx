import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCheck, ImageIcon, Mail, MessageSquareText, PenLine } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlanCards } from "@/components/billing/plan-cards";
import { Compare } from "@/components/marketing/compare";
import { NetworkOrbit } from "@/components/marketing/network-orbit";
import { Faq } from "@/components/marketing/faq";
import {
  AnalyticsDemo,
  ApprovalDemo,
  CalendarDemo,
  HeroProduct,
  ImageDemo,
  InboxDemo,
  MemoryDemo,
  MemoryLearnsDemo,
  PlatformVersions,
  StoryInputDemo,
} from "@/components/marketing/product-demos";
import { Reveal } from "@/components/marketing/reveal";
import { RiseText } from "@/components/motion/rise-text";
import { Spotlight } from "@/components/motion/spotlight";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/lib/site";

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
                See Postory in action
              </Link>
            </div>
          </div>
          <div id="product" className="stage-in mx-auto mt-12 max-w-6xl scroll-mt-24 sm:mt-16" style={{ animationDelay: "0.8s" }}>
            <HeroProduct />
          </div>
        </div>
      </section>

      {/* Networks */}
      <section aria-label="Supported networks" className="relative overflow-hidden border-y border-line bg-surface">
        <div className="hairline-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8 sm:pb-14 sm:pt-20">
          <Reveal>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.16em] text-blue-600">Eight networks · one story</p>
            <h2 className="mx-auto mt-3 max-w-xl text-center font-display text-[32px] leading-[1.05] tracking-[-0.02em] text-balance sm:text-[44px]">
              One story out to <em>every network you use.</em>
            </h2>
          </Reveal>
          <div className="mt-6 sm:mt-4">
            <NetworkOrbit />
          </div>
        </div>
      </section>

      {/* Tell it what happened */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-14">
          <Reveal>
            <SectionIntro
              eyebrow="Tell it what happened"
              title={
                <>
                  One sentence in. <em>Postory does the thinking.</em>
                </>
              }
              body="Type it, paste it or say it out loud — a launch, a hire, a first customer, a busy Saturday. Postory works out what happened, pulls the facts it knows about your business, and finds the angles worth posting."
            />
            <ol className="mt-8 flex flex-col gap-4">
              {[
                {
                  icon: PenLine,
                  title: "You tell it what happened",
                  body: "In your own words. No prompts, no templates.",
                },
                {
                  icon: MessageSquareText,
                  title: "It writes for every network",
                  body: "Same facts, a native version for each place you post.",
                },
                {
                  icon: CheckCheck,
                  title: "You approve. It publishes.",
                  body: "Edit anything. Nothing goes out without your OK.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                    <step.icon className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[15.5px] font-semibold">
                      <span className="mr-2 font-mono text-[11px] text-faint">0{i + 1}</span>
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-[14.5px] text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={0.1}>
            <StoryInputDemo />
          </Reveal>
        </div>
      </section>

      {/* Story → posts */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <Reveal>
            <SectionIntro
              eyebrow="Every network"
              title={
                <>
                  One story. <em>Every network.</em>
                </>
              }
              body="Each network has its own rhythm. Postory changes the structure, length and tone for each one — it doesn't reword the same paragraph. Ask for a change to one version and the others stay exactly as they are."
            />
          </Reveal>
          <Reveal delay={0.1} className="mt-10 sm:mt-14">
            <PlatformVersions />
          </Reveal>
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

      {/* Visuals */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <Reveal className="order-2 lg:order-1">
            <ImageDemo />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <SectionIntro
              eyebrow="Visuals"
              title={
                <>
                  Need a visual? <em>Make one.</em>
                </>
              }
              body="Create an image for the post you're looking at, sized for where it's going — portrait for Instagram, wide for X and LinkedIn. Or upload your own. Instagram, Pinterest and TikTok posts always get the media they need before they can go out."
            />
            <p className="mt-6 flex items-center gap-2 text-[14px] text-muted">
              <ImageIcon className="size-4 text-blue-600" aria-hidden /> Every plan includes AI images each month.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Calendar */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 lg:gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Reveal>
            <SectionIntro
              eyebrow="Calendar"
              title={
                <>
                  Your whole social week, <em>in one place.</em>
                </>
              }
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

      {/* Inbox */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <SectionIntro
            eyebrow="Inbox · rolling out"
            title={
              <>
                Replies shouldn&apos;t live in <em>seven apps.</em>
              </>
            }
            body="Comments and mentions from your connected accounts land in one inbox, each with a reply drafted from what Postory knows about your business. Edit it, approve it, or ignore it — replies are never sent on their own. Networks are switching on one by one."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <InboxDemo />
        </Reveal>
      </section>

      {/* Analytics */}
      <section className="bg-surface py-20 sm:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-10 lg:gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Reveal className="order-2 lg:order-1">
            <AnalyticsDemo />
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <SectionIntro
              eyebrow="Analytics"
              title={
                <>
                  See what&apos;s <em>actually working.</em>
                </>
              }
              body="Plain sentences first, charts second: what went out, where it went, which stories travelled furthest. Numbers come straight from the networks that share them — Postory never fills gaps with guesses."
            />
          </Reveal>
        </div>
      </section>

      {/* Remembers */}
      <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <SectionIntro
            eyebrow="Business memory"
            title={
              <>
                Postory <em>remembers.</em>
              </>
            }
            body="Every story you tell, every question you answer and every preference you set becomes something Postory knows next time. Your tenth post sounds more like you than your first — and you can see, edit or delete everything it knows."
          />
        </Reveal>
        <Reveal delay={0.1}>
          <MemoryLearnsDemo />
        </Reveal>
      </section>

      {/* Compare */}
      <section className="bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-1 px-5 py-20 sm:px-8 sm:py-28 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-14">
          <Reveal>
            <SectionIntro
              eyebrow="Why Postory"
              title={
                <>
                  Not a scheduler. <em>Not a chatbot.</em>
                </>
              }
              body="A scheduler posts what you've already written. A chatbot writes whatever you ask, true or not. Postory does the part in between: it turns what actually happened into posts you'd be happy to put your name on — then gets them out."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <Compare />
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
