"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, CheckCheck, Sparkles } from "lucide-react";
import { PlatformIcon } from "@/components/brand/platform-icon";
import { LogoMark } from "@/components/brand/logo";
import { ColumnChart } from "@/components/app/analytics/column-chart";
import { PostPreview } from "@/components/product/post-preview";
import { PostStatusBadge } from "@/components/product/status-badge";
import { DEMO_LABEL, demoAnalytics, demoBusiness, demoCalendar, demoPosts, demoStory, demoVersions } from "@/lib/demo/data";
import { DemoAvatar } from "@/components/product/demo-avatar";
import type { PostStatus } from "@/lib/posts/state-machine";
import { PLATFORM_META, countCharacters } from "@/lib/social/platforms";
import { cn } from "@/lib/utils";

function DemoTag({ className }: { className?: string }) {
  return (
    <span className={cn("rounded-full bg-wash px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted ring-1 ring-line", className)}>
      {DEMO_LABEL}
    </span>
  );
}

/** Hero centerpiece: the Create → Review surface, built from real Postory components. */
export function HeroProduct() {
  const reduce = useReducedMotion();
  const posts = demoPosts.filter((p) => p.platform !== "instagram").slice(0, 3);
  return (
    <div className="relative">
      <div className="glow-breathe absolute -inset-x-10 -bottom-10 -top-6 -z-10 rounded-[48px] bg-gradient-to-b from-blue-50/80 to-transparent" aria-hidden />
      <div className="glow-breathe absolute left-1/2 top-1/3 -z-10 h-64 w-[70%] -translate-x-1/2 rounded-full bg-blue-400/15 blur-3xl" aria-hidden />
      <div className="overflow-hidden rounded-[28px] bg-surface shadow-float ring-1 ring-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <LogoMark variant="tile" className="size-6" />
            <span className="text-[13px] font-semibold">Story · {demoStory.title}</span>
          </div>
          <DemoTag />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.6fr)]">
          <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">What happened?</p>
            <p className="mt-3 font-display text-[28px] leading-[1.2] tracking-[-0.01em]">{demoStory.source}</p>
            <ul className="mt-6 flex flex-col gap-2.5">
              {["Understanding your story", "Finding angles and writing platform versions", "Checking facts and limits", "Preparing your review"].map((s, i) => (
                <motion.li
                  key={s}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.15 + i * 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-2.5 text-[13px] text-muted"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-blue-500 text-white">
                    <Check className="size-3" aria-hidden />
                  </span>
                  {s}
                </motion.li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {demoStory.angles.map((a) => (
                <span key={a} className="rounded-full bg-blue-50 px-2.5 py-1 text-[12px] font-medium text-blue-700">
                  {a}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 bg-paper/60 p-4 sm:grid-cols-2 lg:p-5">
            {posts.map((post, i) => (
              <motion.div
                key={post.platform}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.9 + i * 0.12, type: "spring", stiffness: 160, damping: 22 }}
                className={cn("rounded-2xl bg-surface p-4 shadow-soft ring-1 ring-line", i === 2 && "hidden sm:col-span-2 sm:block")}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] font-semibold">
                    <PlatformIcon platform={post.platform} tile className="size-6 rounded-[7px]" />
                    {PLATFORM_META[post.platform].name}
                  </span>
                  <PostStatusBadge status={post.status} />
                </div>
                <PostPreview platform={post.platform} content={post.content} authorName={demoBusiness.name} handle={demoBusiness.handle} clamp={i === 1 ? 5 : 4} avatar={<DemoAvatar />} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** How much of the network's limit a post uses — pinned to the card's foot. */
function CharacterMeter({ used, limit }: { used: number; limit: number }) {
  const share = Math.min(1, used / limit);
  return (
    <div className="shrink-0 pt-4">
      <div className="flex items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">
        <span>Fits the limit</span>
        <span className="tabular-nums text-muted">
          {used.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-wash">
        <motion.div
          className="h-full rounded-full bg-blue-500"
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(2, share * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </div>
    </div>
  );
}

/** Side-by-side platform versions — same facts, native voice. */
export function PlatformVersions() {
  return (
    <>
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-3 scrollbar-none sm:-mx-8 sm:scroll-px-8 sm:px-8 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4">
        {demoVersions.map((post) => (
          <div
            key={post.platform}
            className="flex h-[380px] w-[84%] shrink-0 snap-start flex-col rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-line md:h-auto transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-soft)] sm:w-[58%] md:w-auto md:hover:-translate-y-1 md:hover:shadow-lift"
          >
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <PlatformIcon platform={post.platform} tile className="size-7 rounded-lg" />
              {PLATFORM_META[post.platform].name}
            </span>
            <DemoTag />
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden max-md:[mask-image:linear-gradient(to_bottom,black_78%,transparent)]">
          <PostPreview
            platform={post.platform}
            content={post.content}
            authorName={demoBusiness.name}
            handle={demoBusiness.handle}
            media={post.image ? [{ kind: "image", url: post.image, alt: "Example product graphic" }] : []}
            avatar={<DemoAvatar />}
          />
          </div>
          <CharacterMeter used={countCharacters(post.content)} limit={PLATFORM_META[post.platform].charLimit} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] text-faint md:hidden">Swipe to compare networks →</p>
    </>
  );
}

/** A working mini approval queue (local state only, labelled as an example). */
export function ApprovalDemo() {
  const [statuses, setStatuses] = useState<Record<string, PostStatus>>(() => Object.fromEntries(demoPosts.map((p) => [p.platform, p.status === "approved" ? "approved" : p.status === "published" ? "awaiting_review" : p.status])));
  const pending = Object.values(statuses).filter((s) => s === "awaiting_review").length;
  return (
    <div className="rounded-3xl bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">{pending ? `${pending} posts need review` : "Everything's approved"}</p>
          <p className="text-[12.5px] text-muted">{demoStory.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DemoTag className="hidden sm:inline" />
          <button
            type="button"
            onClick={() => setStatuses((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v === "awaiting_review" ? "approved" : v])) as Record<string, PostStatus>)}
            disabled={!pending}
            className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-500 px-3.5 text-[13px] font-medium text-white transition-all hover:bg-blue-600 active:scale-[0.97] disabled:opacity-40"
          >
            <CheckCheck className="size-4" aria-hidden /> Approve all
          </button>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {demoPosts.map((post, i) => (
          <li key={post.platform} className="flex items-center gap-3.5 px-5 py-3.5">
            <PlatformIcon platform={post.platform} tile className="size-8 rounded-[10px]" />
            <p className="min-w-0 flex-1 truncate text-[13.5px] text-ink-soft">{post.content.replace(/\s+/g, " ")}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={statuses[post.platform]}
                initial={{ opacity: 0, scale: 0.85, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: i * 0.07, type: "spring", stiffness: 420, damping: 26 } }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                className="shrink-0"
              >
                <PostStatusBadge status={statuses[post.platform]} />
              </motion.span>
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A month at a glance, with example posts. */
export function CalendarDemo() {
  const days = Array.from({ length: 35 }, (_, i) => i - 2);
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="text-[15px] font-semibold">October</p>
        <DemoTag />
      </div>
      <div className="grid grid-cols-7 border-b border-line text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = demoCalendar.filter((c) => c.day === day);
          return (
            <div key={i} className={cn("min-h-20 border-line p-1.5 sm:min-h-24", i % 7 !== 6 && "border-r", i < 28 && "border-b", day < 1 || day > 31 ? "bg-paper/70" : "")}>
              <p className={cn("mb-1 text-right text-[11px] tabular-nums", day === 12 ? "font-semibold text-blue-600" : "text-faint")}>{day >= 1 && day <= 31 ? day : ""}</p>
              {items.map((item) => (
                <div key={item.title} className="mb-1 flex items-center gap-1 rounded-md bg-wash px-1 py-0.5 text-[10.5px] ring-1 ring-line" title={item.title}>
                  <PlatformIcon platform={item.platform} className="size-2.5 shrink-0" />
                  <span className="truncate text-ink-soft">{item.time}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AnalyticsDemo() {
  const weeks = ["Aug 4", "Aug 11", "Aug 18", "Aug 25", "Sep 1", "Sep 8", "Sep 15", "Sep 22", "Sep 29", "Oct 6", "Oct 13", "Oct 20"];
  return (
    <div className="rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{demoAnalytics.headline}</p>
          <ul className="mt-3 flex flex-col gap-1">
            {demoAnalytics.bullets.map((b) => (
              <li key={b} className="text-[14px] text-muted">
                {b}
              </li>
            ))}
          </ul>
        </div>
        <DemoTag />
      </div>
      <div className="mt-6">
        <ColumnChart data={demoAnalytics.series.map((v, i) => ({ label: weeks[i], value: v }))} label="Engagements per week (example)" unit="engagements" height={150} />
      </div>
    </div>
  );
}

export function MemoryDemo() {
  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-surface p-6 shadow-soft ring-1 ring-line">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Business memory</p>
          <DemoTag />
        </div>
        <ul className="mt-4 flex flex-col divide-y divide-line">
          {[
            ["Product", "Fernwood is a calm habit tracker for iPhone."],
            ["Audience", "People who want fewer, better habits."],
            ["Voice", "Casual, minimal. Lowercase on X is fine."],
            ["Milestone", "Dark mode shipped — 212 people had asked for it."],
          ].map(([k, v]) => (
            <li key={k} className="flex gap-4 py-2.5 text-[13.5px]">
              <span className="w-20 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{k}</span>
              <span className="text-ink-soft">{v}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-success">
            <Check className="size-3.5" aria-hidden /> Postory writes
          </p>
          <p className="mt-2 text-[15px] font-medium">“212 people asked for dark mode.”</p>
        </div>
        <div className="rounded-3xl bg-surface p-5 ring-1 ring-line">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-danger">
            <Sparkles className="size-3.5" aria-hidden /> Postory won&apos;t write
          </p>
          <p className="mt-2 text-[15px] font-medium text-muted line-through decoration-danger/60">“Thousands of users love dark mode.”</p>
        </div>
      </div>
    </div>
  );
}

const TYPED_STORIES = [
  { text: "We shipped dark mode after 212 people asked for it.", angles: ["You asked, we built it", "How we designed it", "What's next"] },
  { text: "Our first wholesale order shipped to a shop in Lisbon this morning.", angles: ["A first", "Where it's going", "Thank you to the team"] },
  { text: "We're open late Friday for a tasting night — six new coffees to try.", angles: ["Event invite", "Meet the coffees", "Why we do it"] },
];

/** "Tell it what happened": a story typed in, Postory reading it, angles appearing. */
export function StoryInputDemo() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(reduce ? TYPED_STORIES[0].text : "");
  const [phase, setPhase] = useState<"typing" | "reading" | "angles">(reduce ? "angles" : "typing");
  const story = TYPED_STORIES[index];

  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed.length < story.text.length) timer = setTimeout(() => setTyped(story.text.slice(0, typed.length + 1)), 28 + Math.random() * 40);
      else timer = setTimeout(() => setPhase("reading"), 500);
    } else if (phase === "reading") {
      timer = setTimeout(() => setPhase("angles"), 1700);
    } else {
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % TYPED_STORIES.length);
        setTyped("");
        setPhase("typing");
      }, 4200);
    }
    return () => clearTimeout(timer);
  }, [phase, typed, story.text, reduce]);

  const steps = ["Understanding what happened", "Pulling facts from your memory", "Finding the angles"];

  return (
    <div className="overflow-hidden rounded-[28px] bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">What happened?</p>
        <DemoTag />
      </div>
      <div className="min-h-[148px] px-6 pb-4 pt-6">
        <p className="font-display text-[26px] leading-[1.25] tracking-[-0.01em] text-ink sm:text-[30px]">
          {typed}
          {phase === "typing" ? <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[3px] animate-[caret-blink_1s_steps(1)_infinite] bg-blue-500 align-baseline" aria-hidden /> : null}
        </p>
      </div>
      <div className="border-t border-line bg-paper/60 px-6 py-5">
        <ul className="flex flex-col gap-2.5">
          {steps.map((s, i) => {
            const done = phase === "angles" || (phase === "reading" && i < 2);
            const active = phase === "reading" && i === 2;
            return (
              <li key={s} className={cn("flex items-center gap-2.5 text-[13.5px] transition-colors duration-500", done ? "text-ink-soft" : active ? "text-ink" : "text-faint")}>
                <span className={cn("grid size-5 place-items-center rounded-full transition-colors duration-500", done ? "bg-blue-500 text-white" : active ? "bg-blue-50 ring-1 ring-blue-200" : "bg-wash")}>
                  {done ? <Check className="size-3" aria-hidden /> : active ? <span className="size-1.5 animate-pulse rounded-full bg-blue-500" /> : null}
                </span>
                {s}
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex min-h-8 flex-wrap gap-1.5">
          <AnimatePresence mode="popLayout">
            {phase === "angles"
              ? story.angles.map((a, i) => (
                  <motion.span
                    key={`${index}-${a}`}
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.12, type: "spring", stiffness: 300, damping: 24 } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1.5 text-[12.5px] font-medium text-blue-700"
                  >
                    <Sparkles className="size-3" aria-hidden />
                    {a}
                  </motion.span>
                ))
              : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const RATIOS = [
  { id: "4:5", label: "Instagram", aspect: "aspect-[4/5]" },
  { id: "1:1", label: "Square", aspect: "aspect-square" },
  { id: "16:9", label: "X & LinkedIn", aspect: "aspect-[16/9]" },
] as const;

/** "Need a visual?": the image fits the network it's going to. */
export function ImageDemo() {
  const reduce = useReducedMotion();
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]["id"]>("4:5");
  const [made, setMade] = useState(Boolean(reduce));
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { once: true, margin: "-120px" });
  // Plays itself once it's on screen; the button is there to see it again.
  useEffect(() => {
    if (!inView || made) return;
    const t = setTimeout(() => setMade(true), 1100);
    return () => clearTimeout(t);
  }, [inView, made]);
  const current = RATIOS.find((r) => r.id === ratio)!;
  return (
    <div ref={frame} className="rounded-3xl bg-surface p-5 shadow-lift ring-1 ring-line sm:p-6">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <PlatformIcon platform="instagram" tile className="size-6 rounded-[7px]" />
          Instagram · Behind the launch
        </span>
        <DemoTag />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Image size">
        {RATIOS.map((r) => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={ratio === r.id}
            onClick={() => setRatio(r.id)}
            className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition-all", ratio === r.id ? "bg-ink text-white ring-ink" : "text-ink-soft ring-line hover:ring-line-strong")}
          >
            {r.id} <span className={ratio === r.id ? "text-white/60" : "text-faint"}>· {r.label}</span>
          </button>
        ))}
      </div>
      <motion.div layout transition={{ type: "spring", stiffness: 220, damping: 28 }} className={cn("relative mx-auto mt-4 w-full max-w-sm overflow-hidden rounded-2xl bg-wash", current.aspect)}>
        <AnimatePresence initial={false}>
          {made ? (
            <motion.div key="img" initial={{ opacity: 0, filter: "blur(16px)", scale: 1.04 }} animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- static demo art */}
              <img src="/demo/fernwood-launch.svg" alt="Example generated visual: a phone showing the Fernwood app on a calm green background" className="size-full object-cover" />
            </motion.div>
          ) : (
            <div className="absolute inset-0 grid place-items-center">
              {inView ? <div className="skeleton absolute inset-0" aria-hidden /> : null}
              <button
                type="button"
                onClick={() => setMade(true)}
                className="relative flex items-center gap-2 rounded-xl bg-surface px-4 py-2.5 text-[13.5px] font-medium shadow-soft ring-1 ring-line transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <Sparkles className={cn("size-4 text-blue-600", inView && "animate-pulse")} aria-hidden /> {inView ? "Creating image…" : "Create image"}
              </button>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        Made for this post and this network. Prefer your own photo? Upload it instead — Postory never invents photos of real people or events.
      </p>
    </div>
  );
}

const DEMO_INBOX = [
  { platform: "x" as const, who: "Maya R.", text: "Is there an Android version?", reply: "Not yet — Fernwood is iPhone-only for now. We'll post here the moment that changes." },
  { platform: "linkedin" as const, who: "Tom Becker", text: "Congrats on the launch! What made you build this?", reply: "Thank you, Tom! We wanted a habit tracker that felt calm instead of guilt-trippy — that's the whole idea." },
  { platform: "instagram" as const, who: "@sunnydays", text: "love the colours 😍", reply: "Thank you! The greens were the hardest part to get right." },
];

/** "Replies shouldn't live in seven apps": one inbox, a drafted reply waiting for approval. */
export function InboxDemo() {
  const [open, setOpen] = useState(0);
  const [sent, setSent] = useState<Set<number>>(new Set());
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <p className="text-[15px] font-semibold">Inbox</p>
        <DemoTag />
      </div>
      <ul className="divide-y divide-line">
        {DEMO_INBOX.map((item, i) => (
          <li key={item.who}>
            <button type="button" onClick={() => setOpen(i)} className={cn("flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors", open === i ? "bg-blue-50/40" : "hover:bg-wash/60")}>
              <PlatformIcon platform={item.platform} tile className="mt-0.5 size-7 shrink-0 rounded-[9px]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  {item.who}
                  {sent.has(i) ? <span className="text-[11px] font-medium text-success">Replied</span> : null}
                </span>
                <span className="block truncate text-[13.5px] text-ink-soft">{item.text}</span>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {open === i ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="mx-5 mb-4 rounded-2xl bg-paper p-4 ring-1 ring-line">
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-blue-600">
                      <Sparkles className="size-3" aria-hidden /> Suggested reply
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink">{item.reply}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSent((s) => new Set(s).add(i))}
                        disabled={sent.has(i)}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white transition-all active:scale-[0.97] disabled:opacity-40"
                      >
                        <Check className="size-3.5" aria-hidden /> {sent.has(i) ? "Approved" : "Approve & send"}
                      </button>
                      <span className="flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium text-muted ring-1 ring-line">Edit</span>
                      <span className="flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium text-muted ring-1 ring-line">Ignore</span>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MEMORY_EVENTS = [
  { source: "Saved from a story", fact: "Opened the Android waitlist — 480 sign-ups in the first week.", tone: "blue" },
  { source: "From your answer", fact: "Postory asked what's next. You said: dark mode, this month.", tone: "green" },
  { source: "You added", fact: "Don't mention Android until it's announced.", tone: "ink" },
  { source: "Your voice", fact: "Casual and short. Lowercase is fine on X.", tone: "amber" },
] as const;

/** "Postory remembers": memory grows from answers you save, facts you add and your voice. */
export function MemoryLearnsDemo() {
  return (
    <div className="rounded-3xl bg-surface p-6 shadow-lift ring-1 ring-line">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">What Postory knows</p>
        <DemoTag />
      </div>
      <ol className="relative mt-5 flex flex-col gap-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
        {MEMORY_EVENTS.map((e, i) => (
          <motion.li
            key={e.fact}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.14, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative pl-7"
          >
            <span
              className={cn(
                "absolute left-0 top-1 size-[15px] rounded-full ring-4 ring-surface",
                e.tone === "blue" ? "bg-blue-500" : e.tone === "green" ? "bg-success" : e.tone === "amber" ? "bg-warning" : "bg-ink",
              )}
              aria-hidden
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-faint">{e.source}</p>
            <p className="mt-1 text-[14.5px] text-ink-soft">{e.fact}</p>
          </motion.li>
        ))}
      </ol>
      <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">Every memory is visible, editable and deletable in Settings. Nothing is saved without you.</p>
    </div>
  );
}
