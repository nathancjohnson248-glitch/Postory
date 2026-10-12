import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/marketing/page-hero";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/billing/plans";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Help",
  description: "How to use Postory: creating stories, connecting networks, reviewing and scheduling posts, AI usage, business memory, billing and troubleshooting.",
  alternates: { canonical: "/help" },
  openGraph: { title: "Postory help", url: "/help" },
};

type Topic = { id: string; title: string; body: ReactNode };

const TOPICS: Topic[] = [
  {
    id: "getting-started",
    title: "Getting started",
    body: (
      <>
        <p>Sign up with your email (Postory sends you a one-time code) and answer a few quick questions about your business and how it sounds. Then tell Postory one thing that happened recently — it writes your first posts before you pick a plan.</p>
        <p>Every plan starts with a {TRIAL_DAYS}-day trial. You can connect networks during setup or later from <strong>Connections</strong>.</p>
      </>
    ),
  },
  {
    id: "stories",
    title: "Creating a story",
    body: (
      <>
        <p>
          Press <strong>+</strong> (or <strong>Create story</strong>) and write what happened, the way you&apos;d tell a friend. A sentence is enough if it says what actually happened — &ldquo;Dark mode is live, 212 people asked for it&rdquo; works; &ldquo;shipped stuff&rdquo; doesn&apos;t.
        </p>
        <p>Pick the networks to write for and press <strong>Generate posts</strong>. You can also dictate, or choose <strong>Write posts myself</strong> to skip the AI.</p>
        <p>If there isn&apos;t enough to go on, Postory asks you a few questions instead of guessing. That doesn&apos;t use a generation.</p>
      </>
    ),
  },
  {
    id: "connecting",
    title: "Connecting networks",
    body: (
      <>
        <p>
          Open <strong>Connections</strong> and press <strong>Connect</strong> next to a network. You sign in on the network&apos;s own page and approve access — Postory never sees your password. Bluesky is coming soon; you can already write posts for it. Pins are saved to your first Pinterest board.
        </p>
        <p>Instagram needs a Business or Creator account, and Facebook posts go to a Page you manage. If a connection expires, the network shows <strong>Reconnect required</strong> and any scheduled posts for it wait until you reconnect.</p>
        <p>You can write posts for a network before it&apos;s connected; they stay as drafts until you connect it.</p>
      </>
    ),
  },
  {
    id: "reviewing",
    title: "Reviewing posts",
    body: (
      <>
        <p>Every post lands in review. For each one you can edit it by hand, ask for a change in plain words (&ldquo;shorter&rdquo;, &ldquo;more confident&rdquo;, &ldquo;sound like me&rdquo;), regenerate it, or reject it. Changes only touch the post you&apos;re working on.</p>
        <p>Postory keeps your facts as you gave them. If a post mentions a number that isn&apos;t in your story or business memory, it&apos;s flagged so you can check it before approving.</p>
        <p>
          When everything looks right, use <strong>Approve all</strong> on the story, or approve posts one by one.
        </p>
      </>
    ),
  },
  {
    id: "scheduling",
    title: "Scheduling and publishing",
    body: (
      <>
        <p>
          Approved posts can be published straight away or scheduled for a time in your timezone. Scheduled posts are sent by Postory&apos;s publishing partner, so your browser doesn&apos;t need to be open. See and move them on the <strong>Calendar</strong>.
        </p>
        <p>Nothing is ever published without your approval. If a network rejects a post, it&apos;s marked as failed with the reason, and you get an email.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI usage and limits",
    body: (
      <>
        <p>Each plan includes a monthly allowance. Generating a story&apos;s posts, regenerating a post or rewriting around a new angle uses one AI generation; asking for a change or using the assistant uses an AI conversation; creating an image uses an AI image. Editing by hand, approving, scheduling and publishing don&apos;t use AI.</p>
        <div className="not-prose my-5 overflow-x-auto rounded-2xl ring-1 ring-line">
          <table className="w-full min-w-[460px] text-left text-[14px]">
            <thead className="bg-wash text-[12.5px] text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Per month</th>
                {PLAN_IDS.map((id) => (
                  <th key={id} className="px-4 py-2.5 font-medium">
                    {PLANS[id].name} · ${PLANS[id].priceMonthlyUsd}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(
                [
                  ["Social accounts", (id) => PLANS[id].limits.socialAccounts ?? "Unlimited"],
                  ["AI post generations", (id) => PLANS[id].limits.aiGenerations],
                  ["AI conversations", (id) => PLANS[id].limits.aiConversations],
                  ["AI images", (id) => PLANS[id].limits.aiImages],
                  ["X credits", (id) => PLANS[id].limits.xCredits.toLocaleString()],
                ] as [string, (id: (typeof PLAN_IDS)[number]) => ReactNode][]
              ).map(([label, value]) => (
                <tr key={label}>
                  <td className="px-4 py-2.5 text-muted">{label}</td>
                  {PLAN_IDS.map((id) => (
                    <td key={id} className="px-4 py-2.5 tabular-nums">
                      {value(id)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Scheduled posts aren&apos;t capped beyond each network&apos;s own limits. If something fails on Postory&apos;s side, nothing is taken from your allowance.</p>
      </>
    ),
  },
  {
    id: "memory",
    title: "Business memory",
    body: (
      <>
        <p>
          Business memory is what Postory knows about your business: what you do, your voice, and facts you&apos;ve saved. When Postory asks a question about a story, you can save your answer there. Find, edit and delete everything in <strong>Settings → Business memory</strong>.
        </p>
        <p>Memory is context, not permission to invent. Postory only states things that are in your story or your memory.</p>
      </>
    ),
  },
  {
    id: "billing",
    title: "Billing",
    body: (
      <>
        <p>
          Payments are handled by HandyPay; your card details never touch Postory. Open <strong>Billing</strong> and press <strong>Manage billing</strong> to update your card, see receipts, change plan or cancel.
        </p>
        <p>If you cancel, you keep access until the end of the period you&apos;ve paid for, and your stories and posts aren&apos;t deleted.</p>
      </>
    ),
  },
  {
    id: "account",
    title: "Account settings",
    body: (
      <p>
        In <strong>Settings</strong> you can change your name, timezone, business details, voice and AI preferences (emoji, hashtags, default networks), and see exactly what Postory can and can&apos;t do with your accounts. You can delete your account there too — it removes your data permanently.
      </p>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    body: (
      <ul>
        <li>
          <strong>&ldquo;Postory&apos;s writer is busy&rdquo;</strong> — the AI provider is rate-limited for a moment. Wait a minute and try again; nothing was used from your plan.
        </li>
        <li>
          <strong>Some posts need another attempt</strong> — Postory saved the posts it finished. Use the retry card on the story to write the rest.
        </li>
        <li>
          <strong>A post failed to publish</strong> — open it to see the network&apos;s reason. Most often the connection expired: reconnect in Connections and publish again.
        </li>
        <li>
          <strong>Didn&apos;t get a sign-in code</strong> — check spam, then press <strong>Send a new code</strong>. Only the newest code works.
        </li>
        <li>
          <strong>Billing shows the wrong plan</strong> — open Billing and press <strong>Refresh from HandyPay</strong>; Postory reads your subscription straight from HandyPay.
        </li>
      </ul>
    ),
  },
];

export default function HelpPage() {
  return (
    <>
      <PageHero eyebrow="Help" title="How to use Postory." body="Short answers to the things people ask most. Can't find yours? Email the founder — you'll get a reply from a person." />
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-5 pb-28 sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Help topics" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-2 scrollbar-none lg:flex-col lg:overflow-visible lg:pb-0">
            {TOPICS.map((t) => (
              <li key={t.id} className="shrink-0">
                <a href={`#${t.id}`} className="block rounded-full px-3 py-1.5 text-[13.5px] text-muted ring-1 ring-line transition-colors hover:bg-wash hover:text-ink lg:rounded-lg lg:ring-0">
                  {t.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 max-w-3xl flex-col">
          {TOPICS.map((t) => (
            <section key={t.id} id={t.id} className="scroll-mt-28 border-t border-line py-10 first:border-t-0 first:pt-0">
              <h2 className="font-display text-[34px] leading-[1.05] tracking-[-0.02em]">{t.title}</h2>
              <div className="mt-4 text-[16px] leading-relaxed text-ink-soft [&_li]:mb-2.5 [&_p]:mb-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">{t.body}</div>
            </section>
          ))}
          <div className="mt-6 rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
            <p className="text-[16px] font-semibold">Still stuck?</p>
            <p className="mt-1 text-[14.5px] text-muted">
              Email <a href={`mailto:${site.founder.email}?subject=Postory%20help`} className="font-medium text-blue-600 hover:underline">{site.founder.email}</a> or message{" "}
              <a href={site.founder.xUrl} target="_blank" rel="noreferrer noopener" className="font-medium text-blue-600 hover:underline">
                {site.founder.xHandle}
              </a>
              . Or <Link href="/how-it-works" className="font-medium text-blue-600 hover:underline">see how Postory works</Link>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
