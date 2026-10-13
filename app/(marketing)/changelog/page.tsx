import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = { title: "Changelog", description: "What's new in Postory, and what's next.", alternates: { canonical: "/changelog" } };

const ENTRIES = [
  {
    date: "October 13, 2026",
    title: "Your networks, read back",
    items: [
      "Connect X, LinkedIn, Instagram, Threads, Facebook and Pinterest on the network's own sign-in screen, and Bluesky with an app password",
      "Engagement on published posts, read back from each network that shares it",
      "Inbox: comments on your Instagram, Threads, Facebook and Bluesky posts, with replies Postory drafts and you send",
      "Plan: Postory suggests what's worth posting next from your stories and memory, and asks when it needs a real detail",
      "Scheduled posts can carry images",
    ],
  },
  {
    date: "October 11, 2026",
    title: "Postory, rebuilt",
    items: [
      "Stories: tell Postory what happened and get a post for each network",
      "Approval-first review with per-network edits in plain language",
      "Scheduling, calendar and drag-to-reschedule",
      "Business memory that keeps facts straight",
      "Plans with a 3-day trial through HandyPay",
    ],
  },
];

const ROADMAP = [
  "Video posts",
  "TikTok publishing, once TikTok approves Postory's app",
  "Agent access: let Claude Code or Cursor draft stories for you to approve",
  "Team members and approvals",
];

export default function ChangelogPage() {
  return (
    <>
      <PageHero eyebrow="Changelog" title={<>What&apos;s new.</>} body="Updates to Postory, newest first." />
      <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        {ENTRIES.map((e) => (
          <article key={e.title} className="border-t border-line py-10">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{e.date}</p>
            <h2 className="mt-3 text-[26px] font-semibold tracking-[-0.02em]">{e.title}</h2>
            <ul className="mt-4 list-disc pl-5 text-[16px] leading-relaxed text-ink-soft">
              {e.items.map((i) => (
                <li key={i} className="mb-1.5">
                  {i}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section id="roadmap" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-28 sm:px-8">
        <div className="rounded-3xl bg-surface p-8 shadow-soft ring-1 ring-line">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Roadmap</h2>
          <p className="mt-1 text-[15px] text-muted">What we&apos;re working towards. No dates promised.</p>
          <ul className="mt-5 list-disc pl-5 text-[16px] leading-relaxed text-ink-soft">
            {ROADMAP.map((r) => (
              <li key={r} className="mb-1.5">
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
