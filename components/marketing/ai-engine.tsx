"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, HelpCircle, RotateCcw, X as XIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { PLATFORM_META, countCharacters, type Platform } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

/**
 * The homepage centrepiece: Postory's AI working through one messy business
 * moment, from raw text to facts, to what it refuses to invent, to six native
 * posts waiting for approval. Scripted and labelled as an example; the real
 * thing runs on the visitor's own stories inside the app.
 */

type Example = {
  id: string;
  label: string;
  story: string;
  facts: { text: string; key?: string }[];
  refused: string[];
  asks: string;
  posts: Record<(typeof NETWORKS)[number], string>;
};

const NETWORKS = ["x", "linkedin", "instagram", "threads", "bluesky", "facebook"] as const satisfies readonly Platform[];

const EXAMPLES: Example[] = [
  {
    id: "launch",
    label: "A launch",
    story: "we finally shipped the ios app today lol. 47 downloads in the first hour, didnt expect that",
    facts: [{ text: "Shipped the iOS app today" }, { text: "47 downloads", key: "47" }, { text: "in the first hour" }, { text: "More than expected" }],
    refused: ["47 customers", "thousands of users", "#1 in the App Store"],
    asks: "Want to say what the app does in one line? It'll make the LinkedIn and Facebook posts land.",
    posts: {
      x: "shipped the iOS app today.\n\n47 downloads in the first hour. genuinely didn't expect that.\n\nthank you, whoever you all are.",
      linkedin:
        "We shipped our iOS app today.\n\nIn the first hour, 47 people downloaded it. I'd braced for single digits.\n\nIt's a small number on paper, but every one of those is someone who chose to try something we built.\n\nIf you're one of the 47: thank you. Tell me what breaks.",
      instagram: "It's on the App Store. 📱\n\n47 downloads in the first hour, way more than we expected for day one.\n\nLink in bio if you want to be number 48.",
      threads: "ok the iOS app is live and 47 people downloaded it in the first hour?? did not see that coming",
      bluesky: "Shipped the iOS app today. 47 downloads in the first hour, which is about 40 more than I'd guessed. Now the fun part: finding out what breaks.",
      facebook: "Big day for us: our iOS app is now on the App Store. 47 of you downloaded it in the first hour, which honestly caught us off guard. Thank you! If you try it, we'd love to hear what you think.",
    },
  },
  {
    id: "outage",
    label: "A bad morning",
    story: "checkout was down for about 2 hours this morning. its fixed now. sorry to everyone who couldnt order",
    facts: [{ text: "Checkout was down" }, { text: "About 2 hours", key: "2" }, { text: "This morning" }, { text: "Fixed now" }],
    refused: ["No orders were lost", "It can't happen again", "A tiny blip"],
    asks: "Do you know what caused it, and do you want to say? Owning the cause builds more trust than a vague apology.",
    posts: {
      x: "checkout was down for about two hours this morning. it's fixed now.\n\nif you tried to order and couldn't: sorry. that's on us.",
      linkedin:
        "Our checkout was down for about two hours this morning. It's fixed now.\n\nIf you tried to place an order during that window and couldn't, I'm sorry. You came to buy something and we weren't there.\n\nIf you have questions, reply here or message me directly.",
      instagram: "A quick, honest update: checkout was down for about two hours this morning. It's working again now.\n\nIf you tried to order and couldn't, we're sorry, and thank you for your patience.",
      threads: "checkout broke this morning for ~2 hours. fixed now. sorry if you got caught in it",
      bluesky: "Checkout was down for about two hours this morning. It's back. Sorry to anyone who tried to order and couldn't.",
      facebook: "Quick update: our checkout was down for about two hours this morning, and it's working again now. If you tried to order and couldn't, we're really sorry. Thanks for bearing with us.",
    },
  },
  {
    id: "hire",
    label: "A first hire",
    story: "hired our first employee!! jess starts monday doing support. weve answered every ticket ourselves for 2 years",
    facts: [{ text: "First hire: Jess" }, { text: "Starts Monday" }, { text: "Role: support" }, { text: "2 years of founder-run support", key: "2" }],
    refused: ["A growing team of experts", "24/7 support", "Faster replies"],
    asks: "Is it OK to name and tag Jess, or should the posts keep her name out?",
    posts: {
      x: "we made our first hire.\n\njess starts monday, on support. after two years of answering every ticket ourselves, that's a strange and very good feeling.",
      linkedin:
        "We've made our first hire.\n\nJess joins on Monday to look after support.\n\nFor two years, every support email was answered by one of us founders. It taught us more about the product than anything else. Handing that over is a big moment.\n\nWelcome aboard, Jess.",
      instagram: "Say hi to our first hire 👋\n\nJess starts Monday, looking after support, after two years of us answering every message ourselves.\n\nWelcome to the team, Jess.",
      threads: "two years of doing all the support ourselves and as of monday that's jess's job. first hire!!",
      bluesky: "First hire: Jess starts Monday on support. Two years of answering every ticket ourselves, and now we get a teammate.",
      facebook: "Some news: we've hired our first team member! Jess starts on Monday and will be looking after support. For the last two years it's just been us answering every message, so this is a big step. Welcome, Jess!",
    },
  },
];

const STAGES = ["Reading what happened", "Pulling out the facts", "Deciding what not to say", "Writing for six networks", "Checking every claim"];

// Timeline (ms from start).
const T = { story: 0, facts: 2400, guard: 4300, write: 6000, check: 9800, ready: 10800 };
const CHAR_MS = 22;
const POST_CHAR_MS = 9;

function useTimeline(running: boolean, runId: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    if (reduced) {
      frame = requestAnimationFrame(() => setElapsed(Number.MAX_SAFE_INTEGER));
      return () => cancelAnimationFrame(frame);
    }
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      // ~30fps is plenty for typing, and halves the renders.
      if (now - last > 32) {
        last = now;
        setElapsed(now - start);
      }
      if (now - start < T.ready + 600) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, runId]);
  return elapsed;
}

export function AiEngine() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [runId, setRunId] = useState(0);
  const example = EXAMPLES[exampleIndex];
  const t = useTimeline(visible, runId);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { threshold: 0.25 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const choose = (i: number) => {
    setExampleIndex(i);
    setRunId((r) => r + 1);
  };

  const storyShown = example.story.slice(0, Math.max(0, Math.floor((t - T.story) / CHAR_MS)));
  const typing = storyShown.length < example.story.length;
  const stage = t >= T.ready ? STAGES.length : t >= T.check ? 4 : t >= T.write ? 3 : t >= T.guard ? 2 : t >= T.facts ? 1 : 0;
  const working = t > 0 && t < T.ready;
  const factsShown = t >= T.facts ? Math.min(example.facts.length, Math.floor((t - T.facts) / 380) + 1) : 0;
  const refusedShown = t >= T.guard ? Math.min(example.refused.length, Math.floor((t - T.guard) / 350) + 1) : 0;
  const ready = t >= T.ready;

  return (
    <div ref={ref} className="relative isolate overflow-hidden rounded-[32px] bg-[#08080b] text-white shadow-[0_60px_120px_-40px_rgb(15_40_140/0.55)] ring-1 ring-white/10 sm:rounded-[40px]">
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(47_91_255/0.38),transparent)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
      </div>

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-8">
        <div className={cn("flex items-center gap-3", working && "mark-thinking")}>
          <span className="relative grid size-9 place-items-center">
            {working ? <span className="absolute inset-0 animate-ping rounded-xl bg-blue-500/40 [animation-duration:1.6s]" aria-hidden /> : null}
            <LogoMark className="relative size-9" />
          </span>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold tracking-[-0.01em]">Postory AI</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/45" aria-live="polite">
              {ready ? "6 posts ready for you" : stage < STAGES.length && t > 0 ? `${STAGES[stage]}…` : "Waiting for a story"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Example stories">
          {EXAMPLES.map((e, i) => (
            <button
              key={e.id}
              role="tab"
              aria-selected={i === exampleIndex}
              onClick={() => choose(i)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                i === exampleIndex ? "bg-white text-ink" : "text-white/60 ring-1 ring-white/15 hover:text-white hover:ring-white/30",
              )}
            >
              {e.label}
            </button>
          ))}
          <button onClick={() => setRunId((r) => r + 1)} className="ml-1 grid size-8 place-items-center rounded-full text-white/50 ring-1 ring-white/15 transition-colors hover:text-white" aria-label="Replay">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
        {/* Left: input → understanding */}
        <div className="flex flex-col gap-4">
          <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">What happened</p>
            <p className="mt-3 min-h-[84px] font-display text-[23px] leading-[1.3] tracking-[-0.01em] text-white sm:text-[26px]">
              {storyShown}
              {typing || t === 0 ? <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-caret bg-blue-400" aria-hidden /> : null}
            </p>
            <span className="sr-only">{example.story}</span>
          </div>

          <ol className="flex flex-col gap-1.5" aria-label="What Postory is doing">
            {STAGES.map((s, i) => (
              <li key={s} className={cn("flex items-center gap-2.5 text-[13.5px] transition-colors duration-500", i < stage ? "text-white/80" : i === stage && t > 0 ? "text-white" : "text-white/30")}>
                <span
                  className={cn(
                    "grid size-5 place-items-center rounded-full ring-1 transition-all duration-500",
                    i < stage ? "bg-blue-500 ring-blue-500" : i === stage && t > 0 ? "ring-blue-400" : "ring-white/15",
                  )}
                >
                  {i < stage ? <Check className="size-3" /> : i === stage && t > 0 ? <span className="size-1.5 animate-pulse rounded-full bg-blue-400" /> : null}
                </span>
                {s}
              </li>
            ))}
          </ol>

          <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">The facts it will use</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {example.facts.slice(0, factsShown).map((f) => (
                <li key={f.text} className="animate-fade-up rounded-full bg-blue-500/15 px-3 py-1 text-[13px] text-blue-100 ring-1 ring-blue-400/30">
                  {f.key ? (
                    <>
                      {f.text.split(f.key)[0]}
                      <strong className="font-semibold text-white">{f.key}</strong>
                      {f.text.split(f.key).slice(1).join(f.key)}
                    </>
                  ) : (
                    f.text
                  )}
                </li>
              ))}
              {factsShown === 0 ? <li className="h-7 w-40 rounded-full bg-white/5" aria-hidden /> : null}
            </ul>

            <p className="mt-5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">What it won&apos;t claim</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {example.refused.slice(0, refusedShown).map((r) => (
                <li key={r} className="flex animate-fade-up items-center gap-1.5 rounded-full px-3 py-1 text-[13px] text-white/45 ring-1 ring-white/10">
                  <XIcon className="size-3 text-red-400" aria-hidden />
                  <span className="line-through decoration-red-400/70">{r}</span>
                </li>
              ))}
              {refusedShown === 0 ? <li className="h-7 w-32 rounded-full bg-white/5" aria-hidden /> : null}
            </ul>

            <div className={cn("mt-5 flex gap-2.5 rounded-2xl bg-white p-3.5 text-ink transition-all duration-700", t >= T.guard + 1200 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
              <HelpCircle className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
              <p className="text-[13.5px] leading-snug">
                <strong className="font-semibold">Postory asks:</strong> {example.asks}
              </p>
            </div>
          </div>
        </div>

        {/* Right: six native posts */}
        <div className="flex flex-col gap-4">
          <ul className="scrollbar-none -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 xl:grid-cols-3">
            {NETWORKS.map((network, i) => {
              const start = T.write + i * 320;
              const text = example.posts[network];
              const shown = t < start ? "" : text.slice(0, Math.floor((t - start) / POST_CHAR_MS));
              const done = shown.length >= text.length;
              const checked = done && t >= T.check + i * 120;
              const meta = PLATFORM_META[network];
              return (
                <li
                  key={network}
                  className={cn(
                    "flex w-[78%] shrink-0 snap-center flex-col rounded-2xl bg-white p-4 text-ink shadow-[0_20px_40px_-20px_rgb(0_0_0/0.6)] transition-all duration-500 sm:w-auto",
                    t >= start ? "opacity-100" : "translate-y-3 opacity-40",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={network} tile className="size-6 rounded-md" />
                    <span className="text-[13px] font-semibold">{meta.name}</span>
                    <span
                      className={cn(
                        "ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-colors",
                        checked ? "bg-success-wash text-success" : t >= start ? "bg-blue-50 text-blue-700" : "bg-wash text-faint",
                      )}
                    >
                      {checked ? "Ready" : t >= start ? (done ? "Checking" : "Writing") : "Queued"}
                    </span>
                  </div>
                  {/* The full text sits invisibly underneath so the card never changes size while typing. */}
                  <div className="mt-3 grid text-[13px] leading-[1.5]">
                    <p className="invisible col-start-1 row-start-1 whitespace-pre-line" aria-hidden>
                      {text}
                    </p>
                    <p className="col-start-1 row-start-1 whitespace-pre-line text-ink-soft">
                      {shown}
                      {t >= start && !done ? <span className="ml-px inline-block h-[1em] w-[1.5px] translate-y-[2px] bg-blue-500" aria-hidden /> : null}
                    </p>
                  </div>
                  <p className="mt-auto pt-2 text-right font-mono text-[10.5px] tabular-nums text-faint">
                    {countCharacters(shown)} / {meta.charLimit.toLocaleString()}
                  </p>
                </li>
              );
            })}
          </ul>

          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 transition-all duration-700",
              ready ? "bg-blue-500 ring-blue-400" : "bg-white/[0.04] ring-white/10",
            )}
          >
            <div>
              <p className="text-[15px] font-semibold">{ready ? "6 posts ready" : "Nothing goes out yet"}</p>
              <p className={cn("text-[13px]", ready ? "text-white/80" : "text-white/45")}>Nothing is published until you approve it.</p>
            </div>
            <span
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-all duration-500",
                ready ? "bg-white text-ink shadow-lg" : "bg-white/10 text-white/40",
              )}
            >
              <CheckCheck className="size-4" aria-hidden /> Approve all
            </span>
          </div>
        </div>
      </div>

      <p className="border-t border-white/10 px-5 py-3 text-center text-[12px] text-white/40 sm:px-8">
        An example, played back. In Postory, this runs live on your own stories, grounded in your business memory.
      </p>
    </div>
  );
}
