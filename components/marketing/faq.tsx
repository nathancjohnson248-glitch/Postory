import { Plus } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/billing/plans";

const QUESTIONS = [
  {
    q: "What does Postory actually do?",
    a: "You tell it what happened in your business — a launch, a hire, a first customer, a busy weekend. Postory works out the story, writes a native post for each network you use, and waits for your approval. Then it publishes or schedules to your connected accounts.",
  },
  {
    q: "Is Postory an AI social media manager?",
    a: "It's the part of one that saves the most time: turning what's happening into good posts, everywhere, on schedule. It drafts, adapts, schedules and publishes. You stay the editor — it doesn't post on its own.",
  },
  {
    q: "How does the AI create posts?",
    a: "From two things only: what you write in the story, and what Postory knows about your business (what you do, your audience, your voice, facts you've saved). It finds a few angles, then writes each network's version to that network's length and rhythm.",
  },
  {
    q: "Will Postory invent facts?",
    a: "No — that's the rule it's built around. Numbers stay exactly as you gave them, and it never makes up customers, quotes, revenue, features or results. If a post would be better with a detail it doesn't have, it asks you. Any figure it can't trace back to you is flagged before you approve.",
  },
  { q: "Can I edit every post?", a: "Yes. Edit any version by hand, or ask in plain words — “make the X version shorter” changes only the X version and leaves the rest alone." },
  {
    q: "Does anything publish without my approval?",
    a: "No. Every post waits in review. It only goes out when you press Publish, or at the time you scheduled after approving it.",
  },
  {
    q: "Which social networks can I connect?",
    a: "Postory publishes to X, LinkedIn, Instagram, Threads, Facebook, Pinterest and Bluesky. You connect each through the network's own sign-in (Bluesky uses an app password), so Postory never sees your password. It also writes TikTok captions, but TikTok only lets audited apps publish, so you post those yourself.",
  },
  {
    q: "Does Postory generate images?",
    a: "Yes. Create an image for a specific post, sized for where it's going, or upload your own. Postory won't generate fake photos of real people, customers or events.",
  },
  {
    q: "Does Postory remember my business?",
    a: "Yes. What you tell it during setup, your answers to its questions and facts you add are saved as business memory and used every time it writes. You can see, edit and delete every item in Settings.",
  },
  {
    q: "Can Postory reply to comments?",
    a: "It's rolling out network by network. Where a network shares comments with Postory, they appear in one inbox with a drafted reply. Replies are always approval-first — nothing is sent on its own.",
  },
  { q: "Can I schedule posts?", a: "Yes. Approve a post, pick a time in your timezone, and Postory publishes it then. Move it later from the calendar." },
  {
    q: "What happens if publishing fails?",
    a: "You'll see it on the post with the network's reason in plain words, and Postory emails you. Fix it and retry — it never quietly posts twice.",
  },
  {
    q: "How does the 3-day trial work?",
    a: `Pick a plan and start a ${TRIAL_DAYS}-day trial. You're not charged until it ends, and you can cancel before then from Billing. One trial per customer.`,
  },
  { q: "Can I cancel anytime?", a: "Yes — from Billing in Postory, or from HandyPay's manage page. You keep access until the end of the period you've paid for." },
  { q: "Who handles payments?", a: "HandyPay. Your card details go straight to HandyPay's secure checkout — Postory never sees or stores them." },
  { q: "What happens if I cancel?", a: "Your stories, posts, memory and connections stay. You can come back any time. Only deleting your account removes your data." },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-3xl bg-surface shadow-soft ring-1 ring-line">
      {QUESTIONS.map(({ q, a }) => (
        <details key={q} className="group px-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-medium">
            {q}
            <Plus className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="pb-5 text-[15px] leading-relaxed text-muted">{a}</p>
        </details>
      ))}
    </div>
  );
}
