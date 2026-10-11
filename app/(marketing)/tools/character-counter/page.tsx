import type { Metadata } from "next";
import { CharacterCounter } from "@/components/marketing/character-counter";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Social media character counter",
  description: "Free character counter for X, LinkedIn, Instagram, Threads, Facebook, Bluesky, Pinterest and TikTok. See what fits each network before you post.",
  alternates: { canonical: "/tools/character-counter" },
};

export default function CharacterCounterPage() {
  return (
    <>
      <PageHero
        eyebrow="Free tool"
        title={
          <>
            Will it fit? <em className="text-blue-600">Every network at once.</em>
          </>
        }
        body="Paste a post and see how it measures against each network's limit — X, LinkedIn, Instagram, Threads, Facebook, Bluesky, Pinterest and TikTok. Nothing you type leaves your browser."
      />
      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 sm:pb-28">
        <CharacterCounter />
        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-faint">
          Counts are by visible character, so an emoji counts once. On X every link counts as 23 characters, and some scripts (like Chinese or Japanese) count double — so
          treat X counts with non-Latin text as a close estimate.
        </p>
      </section>
    </>
  );
}
