import { Plus } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/billing/plans";

const QUESTIONS = [
  { q: "What does Postory actually do?", a: "You tell it what happened in your business. It writes a version for each network you use, you review and approve, and it publishes or schedules them to your connected accounts." },
  { q: "Will it post without asking me?", a: "No. Every post waits for your approval. Publishing only happens when you press Publish, or at a time you scheduled." },
  { q: "Does it make things up?", a: "It's built not to. Postory only uses what's in your story and your business memory, keeps numbers exactly as given, and flags any figure it can't trace back to you." },
  { q: "Which networks are supported?", a: "X, LinkedIn, Instagram, Threads, Facebook, Bluesky, Pinterest and TikTok. Some networks have their own rules — Instagram and Pinterest need an image, TikTok needs a video." },
  { q: "How does the trial work?", a: `Every plan starts with a ${TRIAL_DAYS}-day trial through HandyPay. Cancel before it ends and you won't be charged. One trial per customer.` },
  { q: "What's a “generation”?", a: "One run of Postory writing posts for a story — all the network versions together — or regenerating a single version. Edits you ask for in plain language count as AI conversations." },
  { q: "What happens to my content if I cancel?", a: "It stays. Cancelling or letting a trial end never deletes your stories, posts or connections. Only deleting your account does." },
  { q: "Who handles payments?", a: "HandyPay. Your card details go straight to HandyPay's hosted checkout — Postory never sees them." },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-3xl bg-paper ring-1 ring-line">
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
