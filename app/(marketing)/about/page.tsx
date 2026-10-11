import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/reveal";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Why Postory exists, how it's built, and who's behind it.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES = [
  {
    title: "Nothing goes out without you",
    body: "Every post waits for your approval. Postory never publishes on its own, and scheduled posts only go out because you scheduled them.",
  },
  {
    title: "It never makes things up",
    body: "Posts are written from what you tell Postory and what it has saved about your business. Numbers stay exactly as you gave them. If something's missing, it asks.",
  },
  {
    title: "Honest about what works",
    body: "If a feature isn't switched on, Postory says so instead of pretending. Analytics only show what Postory can actually see.",
  },
  {
    title: "Your content stays yours",
    body: "Cancel any time — your stories and posts aren't deleted. Payment details are held by HandyPay and never touch Postory's servers.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            Built for people who&apos;d <em className="text-blue-600">rather be building.</em>
          </>
        }
        body="Most businesses have plenty worth posting about — launches, milestones, new hires, lessons learned. What they don't have is the time to rewrite it eight different ways. Postory turns one story into a post for every network, and waits for your approval before anything goes out."
      />
      <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRINCIPLES.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="h-full rounded-3xl bg-surface p-7 shadow-soft ring-1 ring-line">
                <p className="font-mono text-[12px] text-faint">0{i + 1}</p>
                <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.02em]">{p.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 sm:mt-24">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[32px] bg-ink px-6 py-12 text-white sm:px-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-300">Who&apos;s behind it</p>
              <p className="mt-4 font-display text-[36px] leading-[1.05] tracking-[-0.02em] sm:text-[48px]">
                Postory is built by {site.founder.name}, an independent founder.
              </p>
              <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
                Questions, ideas, or something that didn&apos;t work the way you expected? Write directly — every message is read by the person building the product.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
              <a href={`mailto:${site.founder.email}`} className={buttonClasses({ size: "lg", variant: "accent", className: "w-full" })}>
                Email {site.founder.email}
              </a>
              <a href={site.founder.xUrl} target="_blank" rel="noreferrer noopener" className={buttonClasses({ size: "lg", variant: "secondary", className: "w-full" })}>
                Follow {site.founder.xHandle} on X
              </a>
            </div>
          </div>
        </Reveal>

        <div className="mt-16 flex flex-col items-start gap-4 sm:mt-20 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-[30px] leading-tight tracking-[-0.01em]">Start with one story.</p>
          <Link href="/signup" className={buttonClasses({ size: "lg", variant: "primary", className: "group" })}>
            Start 3-day trial <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
